import { app } from 'electron';
import * as path from 'path';
import { JsonStore } from './json-store';
import { SchedulesFile, Schedule } from '../types';

const DEFAULT_SCHEDULES: SchedulesFile = {
  schemaVersion: 1,
  schedules: [],
};

export class SchedulesStore extends JsonStore<SchedulesFile> {
  constructor(dataDir?: string) {
    const configDir = dataDir || app.getPath('userData');
    const schedulesPath = path.join(configDir, 'schedules.json');
    
    super(schedulesPath, DEFAULT_SCHEDULES, 1);
  }

  async saveAll(schedules: Schedule[]): Promise<void> {
    // Validate all schedules
    for (const schedule of schedules) {
      this.validateSchedule(schedule);
    }

    await this.set({
      schemaVersion: 1,
      schedules: schedules.map(s => ({ ...s })) // Deep copy
    });
  }

  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<void> {
    await this.update(data => {
      const scheduleIndex = data.schedules.findIndex(s => s.id === scheduleId);
      if (scheduleIndex === -1) {
        throw new Error(`Schedule with id ${scheduleId} not found`);
      }

      const updatedSchedules = [...data.schedules];
      updatedSchedules[scheduleIndex] = {
        ...updatedSchedules[scheduleIndex],
        enabled
      };

      return {
        ...data,
        schedules: updatedSchedules
      };
    });
  }

  async toggleEntry(scheduleId: string, entryId: string, enabled: boolean): Promise<void> {
    await this.update(data => {
      const scheduleIndex = data.schedules.findIndex(s => s.id === scheduleId);
      if (scheduleIndex === -1) {
        throw new Error(`Schedule with id ${scheduleId} not found`);
      }

      const schedule = data.schedules[scheduleIndex];
      const entryIndex = schedule.entries.findIndex(e => e.id === entryId);
      if (entryIndex === -1) {
        throw new Error(`Entry with id ${entryId} not found in schedule ${scheduleId}`);
      }

      const updatedSchedules = [...data.schedules];
      const updatedEntries = [...schedule.entries];
      updatedEntries[entryIndex] = {
        ...updatedEntries[entryIndex],
        enabled
      };

      updatedSchedules[scheduleIndex] = {
        ...schedule,
        entries: updatedEntries
      };

      return {
        ...data,
        schedules: updatedSchedules
      };
    });
  }

  list(): Schedule[] {
    return this.get().schedules;
  }

  findById(id: string): Schedule | undefined {
    return this.get().schedules.find(s => s.id === id);
  }

  getEnabledSchedules(): Schedule[] {
    return this.get().schedules.filter(s => s.enabled);
  }

  getAllEntries() {
    const allEntries = [];
    for (const schedule of this.get().schedules) {
      if (schedule.enabled) {
        for (const entry of schedule.entries) {
          if (entry.enabled) {
            allEntries.push({
              ...entry,
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              scheduleConcurrencyLimit: schedule.concurrencyLimit
            });
          }
        }
      }
    }
    return allEntries;
  }

  private validateSchedule(schedule: Schedule): void {
    if (!schedule.id?.trim()) {
      throw new Error('Schedule ID is required');
    }
    if (!schedule.name?.trim()) {
      throw new Error('Schedule name is required');
    }
    if (!Array.isArray(schedule.entries)) {
      throw new Error('Schedule entries must be an array');
    }

    for (const entry of schedule.entries) {
      if (!entry.id?.trim()) {
        throw new Error('Entry ID is required');
      }
      if (typeof entry.scenarioId !== 'number' || entry.scenarioId <= 0) {
        throw new Error('Entry scenario ID is required and must be a positive number');
      }
      if (!entry.characterId?.trim()) {
        throw new Error('Entry character ID is required');
      }
      if (!entry.cadence) {
        throw new Error('Entry cadence is required');
      }
      if (typeof entry.maxDurationMs !== 'number' || entry.maxDurationMs <= 0) {
        throw new Error('Entry max duration must be a positive number');
      }
      if (!['skip', 'queue', 'kill-previous'].includes(entry.overlapPolicy)) {
        throw new Error('Entry overlap policy must be skip, queue, or kill-previous');
      }
    }
  }
}