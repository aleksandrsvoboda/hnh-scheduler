import { contextBridge, ipcRenderer } from 'electron';
import { Config, Scenario, Character, CredentialRef, Schedule, ActiveRun, HistoryFilter, RunRecord, UpcomingRun } from '../main/types';


// Define the API surface that will be exposed to the renderer
const api = {
  // Settings
  settings: {
    get: (): Promise<Config> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('settings:set', patch),
    updateJavaPath: (javaPath: string): Promise<Config> => ipcRenderer.invoke('settings:updateJavaPath', javaPath),
    updateHafenPath: (hafenPath: string): Promise<Config> => ipcRenderer.invoke('settings:updateHafenPath', hafenPath),
    updateJavaVersion: (isJava18: boolean): Promise<Config> => ipcRenderer.invoke('settings:updateJavaVersion', isJava18),
    updateMinimizeToTray: (enabled: boolean): Promise<Config> => ipcRenderer.invoke('settings:updateMinimizeToTray', enabled),
    updateAutostartOnLogin: (enabled: boolean): Promise<Config> => ipcRenderer.invoke('settings:updateAutostartOnLogin', enabled),
  },

  app: {
    openDataDir: (): Promise<void> => ipcRenderer.invoke('app:openDataDir'),
    browseFile: (options: { title: string; filters: any[] }): Promise<string | null> => ipcRenderer.invoke('app:browseFile', options),
    minimizeWindow: (): Promise<void> => ipcRenderer.invoke('app:minimizeWindow'),
    toggleMaximizeWindow: (): Promise<void> => ipcRenderer.invoke('app:toggleMaximizeWindow'),
    closeWindow: (): Promise<void> => ipcRenderer.invoke('app:closeWindow'),
  },

  // Scenarios
  scenarios: {
    get: (): Promise<Scenario[]> => ipcRenderer.invoke('scenarios:get'),
    getAreaName: (areaId: number): Promise<string> => ipcRenderer.invoke('scenarios:getAreaName', areaId),
    openInEditor: (): Promise<void> => ipcRenderer.invoke('scenarios:openInEditor'),
    onUpdated: (callback: (scenarios: Scenario[]) => void) => {
      const handler = (_: any, scenarios: Scenario[]) => callback(scenarios);
      ipcRenderer.on('scenarios:updated', handler);
      return () => ipcRenderer.removeListener('scenarios:updated', handler);
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error);
      ipcRenderer.on('scenarios:error', handler);
      return () => ipcRenderer.removeListener('scenarios:error', handler);
    },
  },

  // Credentials
  credentials: {
    list: (): Promise<CredentialRef[]> => ipcRenderer.invoke('credentials:list'),
    create: (label: string): Promise<CredentialRef> => ipcRenderer.invoke('credentials:create', label),
    updateLabel: (id: string, label: string): Promise<void> => ipcRenderer.invoke('credentials:updateLabel', id, label),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('credentials:delete', id),
    setSecret: (id: string, credentials: { username: string; password: string }): Promise<void> => 
      ipcRenderer.invoke('credentials:setSecret', id, credentials),
  },

  // Characters
  characters: {
    list: (): Promise<Character[]> => ipcRenderer.invoke('characters:list'),
    create: (character: Omit<Character, 'id'>): Promise<Character> => ipcRenderer.invoke('characters:create', character),
    update: (character: Character): Promise<void> => ipcRenderer.invoke('characters:update', character),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('characters:delete', id),
  },

  // Schedules
  schedules: {
    list: (): Promise<Schedule[]> => ipcRenderer.invoke('schedules:list'),
    save: (schedules: Schedule[]): Promise<void> => ipcRenderer.invoke('schedules:save', schedules),
    toggle: (id: string, enabled: boolean): Promise<void> => ipcRenderer.invoke('schedules:toggle', id, enabled),
  },

  // Runs
  runs: {
    test: (entryId: string): Promise<{ runId: string }> => ipcRenderer.invoke('runs:test', entryId),
    active: (): Promise<ActiveRun[]> => ipcRenderer.invoke('runs:active'),
    upcoming: (limit?: number): Promise<UpcomingRun[]> => ipcRenderer.invoke('runs:upcoming', limit),
    stop: (runId: string): Promise<void> => ipcRenderer.invoke('runs:stop', runId),
    tail: (runId: string, lines?: number): Promise<string> => ipcRenderer.invoke('runs:tail', runId, lines),
    
    // Events
    onStarted: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('run:started', handler);
      return () => ipcRenderer.removeListener('run:started', handler);
    },
    onExit: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('run:exit', handler);
      return () => ipcRenderer.removeListener('run:exit', handler);
    },
    onOutput: (callback: (data: { runId: string; type: 'stdout' | 'stderr'; data: string }) => void) => {
      const handler = (_: any, data: { runId: string; type: 'stdout' | 'stderr'; data: string }) => callback(data);
      ipcRenderer.on('run:output', handler);
      return () => ipcRenderer.removeListener('run:output', handler);
    },
    onSkipped: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('run:skipped', handler);
      return () => ipcRenderer.removeListener('run:skipped', handler);
    },
  },

  // History
  history: {
    query: (filter?: HistoryFilter): Promise<RunRecord[]> => ipcRenderer.invoke('history:query', filter || {}),
  },

  // Screenshots
  screenshots: {
    getFile: (relativePath: string): Promise<{ data: string; path: string }> =>
      ipcRenderer.invoke('screenshot:getFile', relativePath),
    getStats: (days?: number): Promise<{
      totalScreenshots: number;
      totalSizeMB: number;
      oldestDate: string | null;
      newestDate: string | null;
    }> => ipcRenderer.invoke('screenshot:getStats', days),
    openFolder: (relativePath: string): Promise<void> =>
      ipcRenderer.invoke('screenshot:openFolder', relativePath),
  },

  // Skip functionality  
  skip: {
    set: (scheduleId: string, entryId: string): Promise<void> => ipcRenderer.invoke('skip:set', scheduleId, entryId),
    clear: (scheduleId: string, entryId: string): Promise<void> => ipcRenderer.invoke('skip:clear', scheduleId, entryId),
    list: (): Promise<string[]> => ipcRenderer.invoke('skip:list'),
  },
};

// Expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld('api', api);
} catch (error) {
  console.error('Failed to expose API to main world:', error);
}

// Export types for the renderer to use
export type API = typeof api;