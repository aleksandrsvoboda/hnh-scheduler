import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { app } from 'electron';
import { NurglingScenarios, Scenario } from '../types';

export class ScenarioCatalog extends EventEmitter {
  private catalog: Scenario[] = [];
  private watcher?: chokidar.FSWatcher;
  private updateDebounceTimer?: NodeJS.Timeout;
  private lastError: string | null = null;
  private readonly scenariosFilePath: string;

  constructor() {
    super();
    this.scenariosFilePath = path.join(app.getPath('userData'), '..', 'Haven and Hearth', 'scenarios.nurgling.json');
  }

  async initialize(): Promise<void> {
    await this.loadCatalog();
    this.startWatching();
  }

  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = undefined;
    }
  }


  private async loadCatalog(): Promise<void> {
    try {
      const content = await fs.readFile(this.scenariosFilePath, 'utf-8');
      const parsed = JSON.parse(content) as NurglingScenarios;
      
      this.validateCatalog(parsed);
      this.catalog = parsed.scenarios;
      this.lastError = null;
      
      this.emit('catalog:updated', this.catalog);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist - show error but don't create it (user manages this file)
        this.lastError = `Scenarios file not found: ${this.scenariosFilePath}`;
        this.catalog = [];
        this.emit('catalog:error', this.lastError);
        return;
      }
      
      this.lastError = `Failed to load scenarios: ${errorMessage}`;
      console.error('Failed to load scenario catalog:', error);
      this.emit('catalog:error', this.lastError);
    }
  }


  private startWatching(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = chokidar.watch(this.scenariosFilePath, {
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', () => {
      this.debouncedReload();
    });

    this.watcher.on('error', (error) => {
      console.error('Scenario file watcher error:', error);
      this.emit('watcher:error', error);
    });
  }

  private debouncedReload(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      this.loadCatalog();
    }, 500); // 500ms debounce
  }

  private validateCatalog(catalog: NurglingScenarios): void {
    if (!catalog || typeof catalog !== 'object') {
      throw new Error('Invalid catalog format');
    }

    if (!Array.isArray(catalog.scenarios)) {
      throw new Error('Scenarios must be an array');
    }

    const seenIds = new Set<number>();
    
    for (const scenario of catalog.scenarios) {
      if (typeof scenario.id !== 'number') {
        throw new Error('Scenario ID must be a number');
      }
      
      if (seenIds.has(scenario.id)) {
        throw new Error(`Duplicate scenario ID: ${scenario.id}`);
      }
      seenIds.add(scenario.id);

      if (!scenario.name?.trim()) {
        throw new Error(`Scenario ${scenario.id}: name is required`);
      }

      if (!Array.isArray(scenario.steps)) {
        throw new Error(`Scenario ${scenario.id}: steps must be an array`);
      }

      // Validate steps
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        if (!step.id?.trim()) {
          throw new Error(`Scenario ${scenario.id}, step ${i}: step ID is required`);
        }
        if (!step.params || typeof step.params !== 'object') {
          throw new Error(`Scenario ${scenario.id}, step ${i}: params must be an object`);
        }
      }
    }
  }

  getScenarios(): Scenario[] {
    return [...this.catalog];
  }

  findById(id: number): Scenario | undefined {
    return this.catalog.find(s => s.id === id);
  }

  getLastError(): string | null {
    return this.lastError;
  }

  hasError(): boolean {
    return this.lastError !== null;
  }
}