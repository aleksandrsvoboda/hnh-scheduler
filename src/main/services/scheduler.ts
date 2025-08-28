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
        this.jobs.set(entry.id, {
          entryId: entry.id,
          scheduleId: schedule.id,
          entry: entry,
          job: job.job,
          type: job.type,
          startedAt: Date.now()
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
        console.log(`Setting up interval for entry ${entry.id}: every ${cadence.n} ${cadence.unit} = ${intervalMs}ms`);
        
        // Check if there's a start time
        if ((cadence as any).startTimeISO) {
          const startTimeStr = (cadence as any).startTimeISO.replace('Z', '');
          const startTime = new Date(startTimeStr);
          const now = new Date();
          
          console.log(`Start time: ${startTime.toLocaleString()}, Now: ${now.toLocaleString()}`);
          
          // Calculate delay to first execution based on original start time
          let nextExecutionTime = new Date(startTime);
          
          // If start time is in the past, find the next occurrence
          while (nextExecutionTime <= now) {
            nextExecutionTime = new Date(nextExecutionTime.getTime() + intervalMs);
          }
          
          const firstDelay = nextExecutionTime.getTime() - now.getTime();
          
          console.log(`Original start time: ${startTime.toLocaleString()}`);
          console.log(`Next execution time: ${nextExecutionTime.toLocaleString()}`);
          console.log(`First execution in ${firstDelay}ms (${Math.round(firstDelay/1000)}s)`);
          
          // Set timeout for first execution, then start interval
          const timeoutId = setTimeout(() => {
            console.log(`FIRST EXECUTION - Interval callback fired for entry ${entry.id}`);
            triggerRun();
            
            // Now start the regular interval
            const intervalId = setInterval(() => {
              console.log(`RECURRING - Interval callback fired for entry ${entry.id}`);
              triggerRun();
            }, intervalMs);
            
            // Store the interval ID (replacing the timeout)
            const job = this.jobs.get(entry.id);
            if (job) {
              job.job = intervalId;
            }
          }, firstDelay);
          
          console.log(`Timeout created with ID: ${timeoutId}`);
          return { job: timeoutId, type: 'interval' };
        } else {
          // No start time - use regular interval from now
          const intervalId = setInterval(() => {
            console.log(`Interval callback fired for entry ${entry.id} (every ${cadence.n} ${cadence.unit})`);
            triggerRun();
          }, intervalMs);
          
          console.log(`Interval created with ID: ${intervalId}`);
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
    console.log(`=== TRIGGER FIRED for entry ${entry.id} ===`);
    console.log(`Schedule: ${schedule.name}, Entry: scenario ${entry.scenarioId}, character ${entry.characterId}`);
    
    try {
      // Check global concurrency limit
      const globalLimit = this.getGlobalConcurrencyLimit();
      const totalActiveRuns = this.getTotalActiveRuns();
      
      if (totalActiveRuns >= globalLimit) {
        console.log(`Global concurrency limit (${globalLimit}) reached, queueing entry ${entry.id}`);
        this.queueRun(entry);
        return;
      }

      // Check per-schedule concurrency limit
      if (schedule.concurrencyLimit) {
        const scheduleActiveRuns = this.scheduleRunCounts.get(schedule.id) || 0;
        if (scheduleActiveRuns >= schedule.concurrencyLimit) {
          console.log(`Schedule concurrency limit (${schedule.concurrencyLimit}) reached for ${schedule.id}, handling overlap policy`);
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
      console.error(`Error handling trigger for entry ${entry.id}:`, error);
      this.emit('trigger:error', { entryId: entry.id, error });
    }
  }

  private handleCharacterOverlap(schedule: Schedule, entry: ScheduleEntry): void {
    switch (entry.overlapPolicy) {
      case 'skip':
        console.log(`Character ${entry.characterId} busy, skipping entry ${entry.id}`);
        this.emit('run:skipped', { entryId: entry.id, reason: 'character-busy' });
        break;

      case 'queue':
        console.log(`Character ${entry.characterId} busy, queueing entry ${entry.id}`);
        this.queueRun(entry);
        break;

      case 'kill-previous':
        console.log(`Character ${entry.characterId} busy, killing previous run for entry ${entry.id}`);
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
    this.emit('run:dequeue-requested', {
      entryId: nextRun.entryId,
      characterId: nextRun.characterId
    });
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
    console.log('=== Getting upcoming runs ===');
    console.log(`Total registered jobs: ${this.jobs.size}`);
    
    const upcoming: UpcomingRun[] = [];
    const now = new Date();
    const maxLookAhead = 48 * 60 * 60 * 1000; // Look ahead 48 hours for recurring runs

    for (const [entryId, scheduledJob] of this.jobs) {
      console.log(`Processing job: ${entryId}, type: ${scheduledJob.type}`);
      
      try {
        let cadenceType = '';
        const runs: Date[] = [];

        // For cron jobs, calculate next execution time
        if (scheduledJob.type === 'cron' && scheduledJob.job) {
          const nextRun = new Date(now.getTime() + 60000); // Next minute as placeholder
          runs.push(nextRun);
          cadenceType = 'cron';
          console.log(`Cron job ${entryId} - next run: ${nextRun.toLocaleString()}`);
        }

        // For interval jobs, calculate MULTIPLE future runs
        if (scheduledJob.type === 'interval') {
          const entry = scheduledJob.entry;
          if (entry.cadence.type === 'every') {
            const intervalMs = this.calculateInterval(entry.cadence.unit, entry.cadence.n);
            
            // Check if there's a start time set
            if ((entry.cadence as any).startTimeISO) {
              const startTimeStr = (entry.cadence as any).startTimeISO.replace('Z', ''); // Remove Z to treat as local
              const startTime = new Date(startTimeStr);
              
              // Find the next occurrence after now based on original start time
              let nextTime = new Date(startTime);
              while (nextTime <= now) {
                nextTime = new Date(nextTime.getTime() + intervalMs);
              }
              
              // Generate multiple future runs within the look-ahead window
              const endTime = new Date(now.getTime() + maxLookAhead);
              while (nextTime <= endTime) {
                runs.push(new Date(nextTime));
                nextTime = new Date(nextTime.getTime() + intervalMs);
              }
              
              console.log(`${entryId}: Generated ${runs.length} recurring runs from ${startTime.toLocaleString()}`);
            } else {
              // No start time - generate runs from now (fallback)
              let nextTime = new Date(now.getTime() + intervalMs);
              const endTime = new Date(now.getTime() + maxLookAhead);
              while (nextTime <= endTime) {
                runs.push(new Date(nextTime));
                nextTime = new Date(nextTime.getTime() + intervalMs);
              }
              console.log(`${entryId}: Generated ${runs.length} runs from now (no start time)`);
            }
            cadenceType = `every ${entry.cadence.n} ${entry.cadence.unit}`;
          }
        }

        // For timeout jobs (once), only show the single run
        if (scheduledJob.type === 'timeout') {
          const nextRun = new Date(now.getTime() + 30000); // 30 seconds as placeholder
          runs.push(nextRun);
          cadenceType = 'once';
          console.log(`Timeout job ${entryId} - next run: ${nextRun.toLocaleString()}`);
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

        console.log(`Added ${runs.length} upcoming runs for ${entryId}`);
      } catch (error) {
        console.warn(`Failed to get upcoming run info for ${entryId}:`, error);
      }
    }

    console.log(`Found ${upcoming.length} total upcoming runs`);
    
    // Sort by next run time and limit results
    const result = upcoming
      .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
      .slice(0, limit);
      
    console.log('=== End upcoming runs ===');
    return result;
  }
}