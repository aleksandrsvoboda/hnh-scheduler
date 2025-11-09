import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { Schedule, ScheduleEntry, Cadence, UpcomingRun } from '../types';

interface ScheduledJob {
  entryId: string;
  scheduleId: string;
  entry: ScheduleEntry;
  job: cron.ScheduledTask | NodeJS.Timeout;
  type: 'cron' | 'interval' | 'timeout';
  startedAt?: number; // When this job was created/started
  lastRunAt?: number; // When this job last executed
  nextRunAt?: number; // When this job will next execute (stored at creation/update)
}

interface QueuedRun {
  entryId: string;
  characterId: string;
  timestamp: number;
}

export class Scheduler extends EventEmitter {
  private jobs = new Map<string, ScheduledJob>();
  private characterLocks = new Map<string, string>(); // characterId -> runId
  private characterQueues = new Map<string, QueuedRun[]>();
  private scheduleRunCounts = new Map<string, number>();
  private skippedRuns = new Set<string>(); // Set of "scheduleId-entryId" strings

  constructor() {
    super();
  }

  registerSchedules(schedules: Schedule[]): void {
    // Clear existing jobs
    this.clearAllJobs();

    // Register enabled schedules
    for (const schedule of schedules) {
      if (schedule.enabled) {
        this.registerSchedule(schedule);
      }
    }
  }

  private registerSchedule(schedule: Schedule): void {
    for (const entry of schedule.entries) {
      if (entry.enabled) {
        this.registerEntry(schedule, entry);
      }
    }
  }

  private registerEntry(schedule: Schedule, entry: ScheduleEntry): void {
    try {
      const job = this.createJob(schedule, entry);
      if (job) {
        // Calculate the next execution time based on job type
        let nextRunAt: number | undefined;

        if (job.type === 'interval' && entry.cadence.type === 'every') {
          const intervalMs = this.calculateInterval(entry.cadence.unit, entry.cadence.n);

          if ((entry.cadence as any).startTimeISO) {
            // For jobs with start time, calculate next occurrence
            const startTimeStr = (entry.cadence as any).startTimeISO.replace('Z', '');
            const startTime = new Date(startTimeStr);
            const now = new Date();

            let nextExecution = new Date(startTime);
            while (nextExecution <= now) {
              nextExecution = new Date(nextExecution.getTime() + intervalMs);
            }
            nextRunAt = nextExecution.getTime();
          } else {
            // For jobs without start time, next run is interval from now
            nextRunAt = Date.now() + intervalMs;
          }
        } else if (job.type === 'timeout' && entry.cadence.type === 'once') {
          // For once jobs, use the target time
          nextRunAt = new Date((entry.cadence as any).atISO).getTime();
        }

        this.jobs.set(entry.id, {
          entryId: entry.id,
          scheduleId: schedule.id,
          entry: entry,
          job: job.job,
          type: job.type,
          startedAt: Date.now(),
          nextRunAt: nextRunAt
        });
      }
    } catch (error) {
      console.error(`Failed to register entry ${entry.id}:`, error);
      this.emit('entry:error', { entryId: entry.id, error });
    }
  }

  private createJob(schedule: Schedule, entry: ScheduleEntry): { job: cron.ScheduledTask | NodeJS.Timeout; type: 'cron' | 'interval' | 'timeout' } | null {
    const { cadence } = entry;
    
    const triggerRun = () => {
      this.handleTrigger(schedule, entry);
    };

    switch (cadence.type) {
      case 'cron': {
        const task = cron.schedule(cadence.expression, triggerRun, {
          scheduled: true
          // No timezone - use local system time
        });
        return { job: task, type: 'cron' };
      }

      case 'every': {
        const intervalMs = this.calculateInterval(cadence.unit, cadence.n);

        // Check if there's a start time
        if ((cadence as any).startTimeISO) {
          const startTimeStr = (cadence as any).startTimeISO.replace('Z', '');
          const startTime = new Date(startTimeStr);
          const now = new Date();

          // Calculate delay to first execution based on original start time
          let nextExecutionTime = new Date(startTime);
          
          // If start time is in the past, find the next occurrence
          while (nextExecutionTime <= now) {
            nextExecutionTime = new Date(nextExecutionTime.getTime() + intervalMs);
          }
          
          const firstDelay = nextExecutionTime.getTime() - now.getTime();

          
          // Set timeout for first execution, then start interval
          const timeoutId = setTimeout(() => {
            triggerRun();
            
            // Now start the regular interval
            const intervalId = setInterval(() => {
              triggerRun();
            }, intervalMs);
            
            // Store the interval ID (replacing the timeout)
            const job = this.jobs.get(entry.id);
            if (job) {
              job.job = intervalId;
            }
          }, firstDelay);
          

          return { job: timeoutId, type: 'interval' };
        } else {
          // No start time - use regular interval from now
          const intervalId = setInterval(() => {
            triggerRun();
          }, intervalMs);
          
          return { job: intervalId, type: 'interval' };
        }
      }

      case 'once': {
        const targetTime = new Date(cadence.atISO).getTime();
        const now = Date.now();
        
        if (targetTime <= now) {
          console.warn(`Once schedule ${entry.id} is in the past, skipping`);
          return null;
        }

        const delay = targetTime - now;
        const timeoutId = setTimeout(triggerRun, delay);
        return { job: timeoutId, type: 'timeout' };
      }

      default:
        throw new Error(`Unknown cadence type: ${(cadence as any).type}`);
    }
  }

  private calculateInterval(unit: 'minutes' | 'hours', n: number): number {
    switch (unit) {
      case 'minutes':
        return n * 60 * 1000;
      case 'hours':
        return n * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown interval unit: ${unit}`);
    }
  }

  private handleTrigger(schedule: Schedule, entry: ScheduleEntry): void {
    // Track when this job actually triggers and update next run time
    const job = this.jobs.get(entry.id);
    if (job) {
      job.lastRunAt = Date.now();

      // Update next run time for repeating jobs
      if (job.type === 'interval' && entry.cadence.type === 'every') {
        const intervalMs = this.calculateInterval(entry.cadence.unit, entry.cadence.n);
        job.nextRunAt = Date.now() + intervalMs;
      }
    }

    // Check if this run is manually skipped
    if (this.isRunSkipped(schedule.id, entry.id)) {
      this.emit('run:skipped', {
        scheduleId: schedule.id,
        entryId: entry.id, 
        reason: 'manual-skip',
        scenarioId: entry.scenarioId,
        characterId: entry.characterId
      });
      
      // Clear the skip after processing (one-time skip)
      this.skippedRuns.delete(`${schedule.id}-${entry.id}`);
      return;
    }
    
    try {
      // Check global concurrency limit
      const globalLimit = this.getGlobalConcurrencyLimit();
      const totalActiveRuns = this.getTotalActiveRuns();
      
      if (totalActiveRuns >= globalLimit) {
        this.queueRun(entry);
        return;
      }

      // Check per-schedule concurrency limit
      if (schedule.concurrencyLimit) {
        const scheduleActiveRuns = this.scheduleRunCounts.get(schedule.id) || 0;
        if (scheduleActiveRuns >= schedule.concurrencyLimit) {
          this.handleScheduleOverlap(schedule, entry);
          return;
        }
      }

      // Check character lock
      const isCharacterBusy = this.characterLocks.has(entry.characterId);
      
      if (isCharacterBusy) {
        this.handleCharacterOverlap(schedule, entry);
      } else {
        this.startRun(schedule.id, entry);
      }
    } catch (error) {
      this.emit('trigger:error', { entryId: entry.id, error });
    }
  }

  private handleCharacterOverlap(schedule: Schedule, entry: ScheduleEntry): void {
    switch (entry.overlapPolicy) {
      case 'skip':
        this.emit('run:skipped', { entryId: entry.id, reason: 'character-busy' });
        break;

      case 'queue':
        this.queueRun(entry);
        break;

      case 'kill-previous':
        this.killPreviousRun(entry.characterId);
        this.startRun(schedule.id, entry);
        break;
    }
  }

  private handleScheduleOverlap(schedule: Schedule, entry: ScheduleEntry): void {
    // For schedule-level overlap, we default to queue behavior
    this.queueRun(entry);
  }

  private queueRun(entry: ScheduleEntry): void {
    if (!this.characterQueues.has(entry.characterId)) {
      this.characterQueues.set(entry.characterId, []);
    }

    const queue = this.characterQueues.get(entry.characterId)!;
    queue.push({
      entryId: entry.id,
      characterId: entry.characterId,
      timestamp: Date.now()
    });

    this.emit('run:queued', { entryId: entry.id, queuePosition: queue.length });
  }

  private killPreviousRun(characterId: string): void {
    const currentRunId = this.characterLocks.get(characterId);
    if (currentRunId) {
      this.emit('run:kill-requested', { runId: currentRunId, reason: 'overlap-policy' });
    }
  }

  private startRun(scheduleId: string, entry: ScheduleEntry): void {
    // Lock character
    this.characterLocks.set(entry.characterId, entry.id);
    
    // Increment schedule run count
    const currentCount = this.scheduleRunCounts.get(scheduleId) || 0;
    this.scheduleRunCounts.set(scheduleId, currentCount + 1);

    this.emit('run:requested', {
      scheduleId,
      entryId: entry.id,
      scenarioId: entry.scenarioId,
      characterId: entry.characterId,
      maxDurationMs: entry.maxDurationMs,
      retries: entry.retries
    });
  }

  onRunCompleted(runId: string, entryId: string): void {
    // Find which character this was for
    let characterId: string | null = null;
    for (const [charId, lockedRunId] of this.characterLocks.entries()) {
      if (lockedRunId === entryId) {
        characterId = charId;
        break;
      }
    }

    if (characterId) {
      // Release character lock
      this.characterLocks.delete(characterId);

      // Process queue for this character
      this.processCharacterQueue(characterId);
    }

    // Decrement schedule run count
    for (const [scheduleId, count] of this.scheduleRunCounts.entries()) {
      if (count > 0) {
        this.scheduleRunCounts.set(scheduleId, count - 1);
      }
    }
  }

  private processCharacterQueue(characterId: string): void {
    const queue = this.characterQueues.get(characterId);
    if (!queue || queue.length === 0) {
      return;
    }

    const nextRun = queue.shift()!;
    
    // Find the schedule and entry for this queued run
    const job = this.jobs.get(nextRun.entryId);
    if (job) {
      // Check concurrency limits again before starting queued run
      const globalLimit = this.getGlobalConcurrencyLimit();
      const totalActiveRuns = this.getTotalActiveRuns();
      
      if (totalActiveRuns >= globalLimit) {
        // Re-queue if we're still at global limit
        queue.unshift(nextRun);
        return;
      }
      
      this.startRun(job.scheduleId, job.entry);
    }
  }

  clearAllJobs(): void {
    for (const [entryId, scheduledJob] of this.jobs.entries()) {
      this.clearJob(scheduledJob);
    }
    this.jobs.clear();
    this.scheduleRunCounts.clear();
  }

  private clearJob(scheduledJob: ScheduledJob): void {
    try {
      switch (scheduledJob.type) {
        case 'cron':
          (scheduledJob.job as cron.ScheduledTask).stop();
          break;
        case 'interval':
          clearInterval(scheduledJob.job as NodeJS.Timeout);
          break;
        case 'timeout':
          clearTimeout(scheduledJob.job as NodeJS.Timeout);
          break;
      }
    } catch (error) {
      console.error(`Failed to clear job for entry ${scheduledJob.entryId}:`, error);
    }
  }

  getActiveJobs(): Array<{ entryId: string; scheduleId: string; type: string }> {
    return Array.from(this.jobs.values()).map(job => ({
      entryId: job.entryId,
      scheduleId: job.scheduleId,
      type: job.type
    }));
  }

  getCharacterLocks(): Record<string, string> {
    return Object.fromEntries(this.characterLocks);
  }

  getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    for (const [characterId, queue] of this.characterQueues.entries()) {
      status[characterId] = queue.length;
    }
    return status;
  }

  private getGlobalConcurrencyLimit(): number {
    // This should be injected or retrieved from config
    return 3; // Default value
  }

  private getTotalActiveRuns(): number {
    return Array.from(this.scheduleRunCounts.values()).reduce((sum, count) => sum + count, 0);
  }

  getUpcomingRuns(limit: number = 10): UpcomingRun[] {

    const upcoming: UpcomingRun[] = [];
    const now = new Date();
    const maxLookAhead = 48 * 60 * 60 * 1000; // Look ahead 48 hours for recurring runs

    for (const [entryId, scheduledJob] of this.jobs) {

      try {
        let cadenceType = '';
        const runs: Date[] = [];

        // For cron jobs, calculate next execution time
        if (scheduledJob.type === 'cron' && scheduledJob.job) {
          const nextRun = new Date(now.getTime() + 60000); // Next minute as placeholder
          runs.push(nextRun);
          cadenceType = 'cron';
        }

        // For interval jobs, use stored next execution time
        if (scheduledJob.type === 'interval') {
          const entry = scheduledJob.entry;
          if (entry.cadence.type === 'every') {
            const intervalMs = this.calculateInterval(entry.cadence.unit, entry.cadence.n);

            // Use the stored next execution time - this is the actual time the job will run
            let nextTime: Date;

            if (scheduledJob.nextRunAt) {
              nextTime = new Date(scheduledJob.nextRunAt);
            } else {
              // Fallback (shouldn't happen normally)
              nextTime = new Date(now.getTime() + intervalMs);
            }

            // Generate multiple future runs within the look-ahead window
            const endTime = new Date(now.getTime() + maxLookAhead);
            while (nextTime <= endTime) {
              runs.push(new Date(nextTime));
              nextTime = new Date(nextTime.getTime() + intervalMs);
            }
            cadenceType = `every ${entry.cadence.n} ${entry.cadence.unit}`;
          }
        }

        // For timeout jobs (once), only show the single run
        if (scheduledJob.type === 'timeout') {
          const nextRun = new Date(now.getTime() + 30000); // 30 seconds as placeholder
          runs.push(nextRun);
          cadenceType = 'once';
        }

        // Add all calculated runs to the upcoming list
        runs.forEach((runTime, index) => {
          const upcomingRun = {
            entryId: `${entryId}-${index}`, // Make each run unique
            scheduleId: scheduledJob.scheduleId,
            scenarioId: scheduledJob.entry.scenarioId,
            characterId: scheduledJob.entry.characterId,
            nextRunAt: runTime.toISOString(),
            cadenceType
          };
          upcoming.push(upcomingRun);
        });
      } catch (error) {
        console.warn(`Failed to get upcoming run info for ${entryId}:`, error);
      }
    }
    
    // Sort by next run time and limit results
    const result = upcoming
      .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
      .slice(0, limit);
    return result;
  }

  // Skip functionality methods
  async setRunSkipped(scheduleId: string, entryId: string): Promise<void> {
    const skipKey = `${scheduleId}-${entryId}`;
    this.skippedRuns.add(skipKey);
  }

  async clearRunSkipped(scheduleId: string, entryId: string): Promise<void> {
    const skipKey = `${scheduleId}-${entryId}`;
    this.skippedRuns.delete(skipKey);
  }

  async getSkippedRuns(): Promise<string[]> {
    return Array.from(this.skippedRuns);
  }

  private isRunSkipped(scheduleId: string, entryId: string): boolean {
    const skipKey = `${scheduleId}-${entryId}`;
    return this.skippedRuns.has(skipKey);
  }
}