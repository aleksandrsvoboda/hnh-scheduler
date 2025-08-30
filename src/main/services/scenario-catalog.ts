import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { app } from 'electron';
import { NurglingScenarios, Scenario, NurglingAreas, Area } from '../types';

export class ScenarioCatalog extends EventEmitter {
  private catalog: Scenario[] = [];
  private areas: Area[] = [];
  private watcher?: chokidar.FSWatcher;
  private areasWatcher?: chokidar.FSWatcher;
  private updateDebounceTimer?: NodeJS.Timeout;
  private areasDebounceTimer?: NodeJS.Timeout;
  private lastError: string | null = null;
  private readonly scenariosFilePath: string;
  private readonly areasFilePath: string;

  constructor() {
    super();
    const hafenDataDir = path.join(app.getPath('userData'), '..', 'Haven and Hearth');
    this.scenariosFilePath = path.join(hafenDataDir, 'scenarios.nurgling.json');
    this.areasFilePath = path.join(hafenDataDir, 'areas.nurgling.json');
  }

  async initialize(): Promise<void> {
    await this.loadCatalog();
    await this.loadAreas();
    this.startWatching();
  }

  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    if (this.areasWatcher) {
      await this.areasWatcher.close();
      this.areasWatcher = undefined;
    }
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = undefined;
    }
    if (this.areasDebounceTimer) {
      clearTimeout(this.areasDebounceTimer);
      this.areasDebounceTimer = undefined;
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

  private async loadAreas(): Promise<void> {
    try {
      const content = await fs.readFile(this.areasFilePath, 'utf-8');
      const parsed = JSON.parse(content) as NurglingAreas;
      
      this.validateAreas(parsed);
      this.areas = parsed.areas;
      
      this.emit('areas:updated', this.areas);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist - this is optional, just use empty areas
        this.areas = [];
        return;
      }
      
      console.warn('Failed to load areas catalog:', error);
      this.areas = [];
    }
  }


  private startWatching(): void {
    // Watch scenarios file
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

    // Watch areas file
    if (this.areasWatcher) {
      this.areasWatcher.close();
    }

    this.areasWatcher = chokidar.watch(this.areasFilePath, {
      persistent: true,
      ignoreInitial: true,
    });

    this.areasWatcher.on('change', () => {
      this.debouncedAreasReload();
    });

    this.areasWatcher.on('error', (error) => {
      console.error('Areas file watcher error:', error);
      this.emit('areas:watcher:error', error);
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

  private debouncedAreasReload(): void {
    if (this.areasDebounceTimer) {
      clearTimeout(this.areasDebounceTimer);
    }

    this.areasDebounceTimer = setTimeout(() => {
      this.loadAreas();
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

  private validateAreas(areas: NurglingAreas): void {
    if (!areas || typeof areas !== 'object') {
      throw new Error('Invalid areas format');
    }

    if (!Array.isArray(areas.areas)) {
      throw new Error('Areas must be an array');
    }

    for (const area of areas.areas) {
      if (typeof area.id !== 'number') {
        throw new Error('Area ID must be a number');
      }
      
      if (!area.name?.trim()) {
        throw new Error(`Area ${area.id}: name is required`);
      }
    }
  }

  getScenarios(): Scenario[] {
    return [...this.catalog];
  }

  getAreas(): Area[] {
    return [...this.areas];
  }

  findById(id: number): Scenario | undefined {
    return this.catalog.find(s => s.id === id);
  }

  findAreaById(id: number): Area | undefined {
    return this.areas.find(a => a.id === id);
  }

  getAreaName(areaId: number): string {
    const area = this.findAreaById(areaId);
    return area?.name || `${areaId}`;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  hasError(): boolean {
    return this.lastError !== null;
  }
}