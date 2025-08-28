import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export abstract class JsonStore<T extends { schemaVersion: number }> extends EventEmitter {
  protected data: T;
  private saveDebounceTimer?: NodeJS.Timeout;

  constructor(
    private filePath: string,
    private defaultValue: T,
    private expectedSchemaVersion: number
  ) {
    super();
    this.data = { ...defaultValue };
  }

  async load(): Promise<T> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as T;
      
      this.validate(parsed);
      this.data = this.migrate(parsed);
      
      return this.data;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, use defaults
        this.data = { ...this.defaultValue };
        await this.saveAtomic(this.data);
        return this.data;
      }
      throw error;
    }
  }

  async saveAtomic(data: T): Promise<void> {
    this.validate(data);
    
    // Create backup
    await this.backup(data);
    
    // Atomic write with temp file
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, this.filePath);
    
    this.data = { ...data };
    this.emit('saved', data);
  }

  async saveDebouncedAtomic(data: T, delayMs: number = 1000): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    this.saveDebounceTimer = setTimeout(() => {
      this.saveAtomic(data).catch(err => this.emit('error', err));
    }, delayMs);
  }

  private async backup(data: T): Promise<void> {
    try {
      const backupDir = path.join(path.dirname(this.filePath), '.backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.basename(this.filePath, '.json');
      const backupPath = path.join(backupDir, `${filename}.${timestamp}.json`);
      
      await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      // Backup failure shouldn't prevent main operation
      console.warn('Backup failed:', error);
    }
  }

  protected validate(data: T): void {
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid data format for ${this.filePath}`);
    }
    if (data.schemaVersion !== this.expectedSchemaVersion) {
      // Allow migration to handle version differences
      if (typeof data.schemaVersion !== 'number') {
        throw new Error(`Missing schemaVersion in ${this.filePath}`);
      }
    }
  }

  protected migrate(data: T): T {
    if (data.schemaVersion === this.expectedSchemaVersion) {
      return data;
    }
    
    // Override in subclasses for actual migration logic
    console.warn(`No migration defined for ${this.filePath} from version ${data.schemaVersion} to ${this.expectedSchemaVersion}`);
    return { ...data, schemaVersion: this.expectedSchemaVersion as any };
  }

  get(): T {
    return { ...this.data };
  }

  async set(data: T): Promise<void> {
    await this.saveAtomic(data);
  }

  async update(updater: (current: T) => T): Promise<void> {
    const updated = updater({ ...this.data });
    await this.saveAtomic(updated);
  }
}