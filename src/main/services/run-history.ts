import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { RunRecord, HistoryFilter } from '../types';

export class RunHistory extends EventEmitter {
  private historyDir: string;

  constructor(dataDir: string) {
    super();
    this.historyDir = path.join(dataDir, 'run-history');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create history directory:', error);
      throw error;
    }
  }

  async appendRecord(record: RunRecord): Promise<void> {
    try {
      const date = new Date(record.ts);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const filePath = path.join(this.historyDir, `${dateStr}.jsonl`);
      
      const line = JSON.stringify(record) + '\n';
      await fs.appendFile(filePath, line, 'utf-8');
      
      this.emit('record:added', record);
    } catch (error) {
      console.error('Failed to append run record:', error);
      this.emit('record:error', error);
      throw error;
    }
  }

  async query(filter: HistoryFilter = {}): Promise<RunRecord[]> {
    try {
      const files = await this.getRelevantFiles(filter);
      const records: RunRecord[] = [];

      for (const file of files) {
        const filePath = path.join(this.historyDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const record = JSON.parse(line) as RunRecord;
            if (this.matchesFilter(record, filter)) {
              records.push(record);
            }
          } catch (parseError) {
            console.warn(`Failed to parse history line: ${line}`, parseError);
          }
        }
      }

      // Sort by timestamp descending (most recent first)
      records.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

      return records;
    } catch (error) {
      console.error('Failed to query run history:', error);
      return [];
    }
  }

  async getRecentFailures(limit: number = 10): Promise<RunRecord[]> {
    const filter: HistoryFilter = {
      status: 'error',
      fromISO: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
    };
    
    const records = await this.query(filter);
    return records.slice(0, limit);
  }

  async pruneOldLogs(retentionDays: number): Promise<void> {
    try {
      const files = await fs.readdir(this.historyDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const filesToDelete = files.filter(file => {
        if (!file.match(/^\d{4}-\d{2}-\d{2}\.jsonl$/)) {
          return false;
        }
        
        const dateStr = file.replace('.jsonl', '');
        const fileDate = new Date(dateStr);
        return fileDate < cutoffDate;
      });

      for (const file of filesToDelete) {
        const filePath = path.join(this.historyDir, file);
        await fs.unlink(filePath);
      }

      if (filesToDelete.length > 0) {
        this.emit('pruned', filesToDelete);
      }
    } catch (error) {
      console.error('Failed to prune old history logs:', error);
      this.emit('prune:error', error);
    }
  }

  private async getRelevantFiles(filter: HistoryFilter): Promise<string[]> {
    try {
      const allFiles = await fs.readdir(this.historyDir);
      const historyFiles = allFiles.filter(file => file.match(/^\d{4}-\d{2}-\d{2}\.jsonl$/));
      
      if (!filter.fromISO && !filter.toISO) {
        return historyFiles;
      }

      const fromDate = filter.fromISO ? new Date(filter.fromISO) : null;
      const toDate = filter.toISO ? new Date(filter.toISO) : null;

      return historyFiles.filter(file => {
        const dateStr = file.replace('.jsonl', '');
        const fileDate = new Date(dateStr);
        
        if (fromDate && fileDate < fromDate) {
          return false;
        }
        if (toDate && fileDate > toDate) {
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error('Failed to list history files:', error);
      return [];
    }
  }

  private matchesFilter(record: RunRecord, filter: HistoryFilter): boolean {
    if (filter.fromISO && record.ts < filter.fromISO) {
      return false;
    }
    
    if (filter.toISO && record.ts > filter.toISO) {
      return false;
    }
    
    if (filter.scenarioId && record.scenarioId !== filter.scenarioId) {
      return false;
    }
    
    if (filter.characterId && record.characterId !== filter.characterId) {
      return false;
    }
    
    if (filter.status && record.status !== filter.status) {
      return false;
    }
    
    return true;
  }

  async getStatistics(days: number = 7): Promise<{
    totalRuns: number;
    successRate: number;
    averageDurationMs: number;
    statusCounts: Record<string, number>;
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    const records = await this.query({
      fromISO: fromDate.toISOString()
    });

    if (records.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        averageDurationMs: 0,
        statusCounts: {}
      };
    }

    const statusCounts = records.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const successCount = statusCounts.success || 0;
    const successRate = (successCount / records.length) * 100;

    const totalDuration = records.reduce((sum, record) => sum + record.durationMs, 0);
    const averageDurationMs = totalDuration / records.length;

    return {
      totalRuns: records.length,
      successRate,
      averageDurationMs,
      statusCounts
    };
  }
}