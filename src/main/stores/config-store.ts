import { app } from 'electron';
import * as path from 'path';
import { JsonStore } from './json-store';
import { Config } from '../types';

const DEFAULT_CONFIG: Config = {
  schemaVersion: 1,
  globalConcurrencyLimit: 3,
  autostartOnLogin: false,
  logRetentionDays: 14,
  // Default game configuration
  javaPath: 'java',
  hafenPath: 'hafen.jar',
  isJava18: false,
  // Default window management settings
  autoMinimizeWindow: false,
  minimizeToTray: false,
};

export class ConfigStore extends JsonStore<Config> {
  constructor(dataDir?: string) {
    const configDir = dataDir || path.join(app.getPath('userData'), '..', 'Haven and Hearth', 'autolauncher');
    const configPath = path.join(configDir, 'config.json');
    
    super(configPath, DEFAULT_CONFIG, 1);
  }


  async updateTimezone(timezone: string): Promise<void> {
    await this.update(config => ({
      ...config,
      defaultTimezone: timezone
    }));
  }

  async updateConcurrencyLimit(limit: number): Promise<void> {
    if (limit < 1) throw new Error('Concurrency limit must be at least 1');
    
    await this.update(config => ({
      ...config,
      globalConcurrencyLimit: limit
    }));
  }

  async updateAutostartOnLogin(enabled: boolean): Promise<void> {
    await this.update(config => ({
      ...config,
      autostartOnLogin: enabled
    }));
  }

  async updateLogRetention(days: number): Promise<void> {
    if (days < 1) throw new Error('Log retention must be at least 1 day');
    
    await this.update(config => ({
      ...config,
      logRetentionDays: days
    }));
  }

  async updateJavaPath(javaPath: string): Promise<void> {
    await this.update(config => ({
      ...config,
      javaPath: javaPath.trim()
    }));
  }

  async updateHafenPath(hafenPath: string): Promise<void> {
    await this.update(config => ({
      ...config,
      hafenPath: hafenPath.trim()
    }));
  }

  async updateJavaVersion(isJava18: boolean): Promise<void> {
    await this.update(config => ({
      ...config,
      isJava18
    }));
  }

  async updateMinimizeToTray(enabled: boolean): Promise<void> {
    await this.update(config => ({
      ...config,
      minimizeToTray: enabled
    }));
  }
}