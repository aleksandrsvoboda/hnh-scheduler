import { ipcMain, shell, dialog } from 'electron';
import { ConfigStore } from './stores/config-store';
import { CredentialsStore } from './stores/credentials-store';
import { CharactersStore } from './stores/characters-store';
import { SchedulesStore } from './stores/schedules-store';
import { ScenarioCatalog } from './services/scenario-catalog';
import { CredentialVault } from './services/credential-vault';
import { ProcessManager } from './services/process-manager';
import { RunHistory } from './services/run-history';
import { Scheduler } from './services/scheduler';
import { Config, Schedule, Character, CredentialRef, HistoryFilter, RunRecord } from './types';

export class IPCManager {
  constructor(
    private configStore: ConfigStore,
    private credentialsStore: CredentialsStore,
    private charactersStore: CharactersStore,
    private schedulesStore: SchedulesStore,
    private scenarioCatalog: ScenarioCatalog,
    private credentialVault: CredentialVault,
    private processManager: ProcessManager,
    private runHistory: RunHistory,
    private scheduler: Scheduler
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Settings
    ipcMain.handle('settings:get', () => {
      return this.configStore.get();
    });

    ipcMain.handle('settings:set', async (_, patch: Partial<Config>) => {
      const current = this.configStore.get();
      const updated = { ...current, ...patch };
      await this.configStore.set(updated);
      
      return updated;
    });

    // Specific handlers for game configuration
    ipcMain.handle('settings:updateJavaPath', async (_, javaPath: string) => {
      await this.configStore.updateJavaPath(javaPath);
      return this.configStore.get();
    });

    ipcMain.handle('settings:updateHafenPath', async (_, hafenPath: string) => {
      await this.configStore.updateHafenPath(hafenPath);
      return this.configStore.get();
    });

    ipcMain.handle('settings:updateJavaVersion', async (_, isJava18: boolean) => {
      await this.configStore.updateJavaVersion(isJava18);
      return this.configStore.get();
    });

    ipcMain.handle('app:openDataDir', async () => {
      const config = this.configStore.get();
      const dataDir = config.dataDir || require('path').join(require('electron').app.getPath('userData'), '..', 'Haven and Hearth', 'autolauncher');
      await shell.openPath(dataDir);
    });

    ipcMain.handle('app:browseFile', async (_, options: { title: string; filters: any[] }) => {
      const result = await dialog.showOpenDialog({
        title: options.title,
        filters: options.filters,
        properties: ['openFile']
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      
      return result.filePaths[0];
    });

    // Scenarios
    ipcMain.handle('scenarios:get', () => {
      return this.scenarioCatalog.getScenarios();
    });

    ipcMain.handle('scenarios:openInEditor', async () => {
      const scenariosPath = require('path').join(require('electron').app.getPath('userData'), '..', 'Haven and Hearth', 'scenarios.nurgling.json');
      await shell.openPath(scenariosPath);
    });

    // Credentials
    ipcMain.handle('credentials:list', () => {
      return this.credentialsStore.list();
    });

    ipcMain.handle('credentials:create', async (_, label: string) => {
      if (!label?.trim()) {
        throw new Error('Label is required');
      }
      return await this.credentialsStore.create(label);
    });

    ipcMain.handle('credentials:updateLabel', async (_, id: string, label: string) => {
      if (!id?.trim()) {
        throw new Error('ID is required');
      }
      if (!label?.trim()) {
        throw new Error('Label is required');
      }
      await this.credentialsStore.updateLabel(id, label);
    });

    ipcMain.handle('credentials:delete', async (_, id: string) => {
      if (!id?.trim()) {
        throw new Error('ID is required');
      }
      
      // Check if any characters use this credential
      const characters = this.charactersStore.findByCredentialId(id);
      if (characters.length > 0) {
        throw new Error(`Cannot delete credential: ${characters.length} character(s) still use it`);
      }
      
      await this.credentialsStore.delete(id);
      await this.credentialVault.deleteSecret(id);
    });

    ipcMain.handle('credentials:setSecret', async (_, id: string, secret: { username: string; password: string }) => {
      if (!id?.trim()) {
        throw new Error('ID is required');
      }
      if (!secret?.username?.trim() || !secret?.password?.trim()) {
        throw new Error('Username and password are required');
      }
      
      // Verify credential exists
      const credential = this.credentialsStore.findById(id);
      if (!credential) {
        throw new Error('Credential not found');
      }
      
      await this.credentialVault.setSecret(id, secret);
    });

    // Characters
    ipcMain.handle('characters:list', () => {
      return this.charactersStore.list();
    });

    ipcMain.handle('characters:create', async (_, character: Omit<Character, 'id'>) => {
      // Validate credential exists
      const credential = this.credentialsStore.findById(character.credentialId);
      if (!credential) {
        throw new Error('Credential not found');
      }
      
      return await this.charactersStore.create(character);
    });

    ipcMain.handle('characters:update', async (_, character: Character) => {
      // Validate credential exists
      const credential = this.credentialsStore.findById(character.credentialId);
      if (!credential) {
        throw new Error('Credential not found');
      }
      
      await this.charactersStore.updateCharacter(character);
    });

    ipcMain.handle('characters:delete', async (_, id: string) => {
      if (!id?.trim()) {
        throw new Error('ID is required');
      }
      
      // Check if any schedule entries use this character
      const allEntries = this.schedulesStore.getAllEntries();
      const usingCharacter = allEntries.filter(entry => entry.characterId === id);
      if (usingCharacter.length > 0) {
        throw new Error(`Cannot delete character: ${usingCharacter.length} schedule entry(ies) still use it`);
      }
      
      await this.charactersStore.delete(id);
    });

    // Schedules
    ipcMain.handle('schedules:list', () => {
      return this.schedulesStore.list();
    });

    ipcMain.handle('schedules:save', async (_, schedules: Schedule[]) => {
      // Validate all references
      for (const schedule of schedules) {
        for (const entry of schedule.entries) {
          // Check scenario exists
          const scenario = this.scenarioCatalog.findById(entry.scenarioId);
          if (!scenario) {
            throw new Error(`Scenario not found: ${entry.scenarioId}`);
          }
          
          // Check character exists
          const character = this.charactersStore.findById(entry.characterId);
          if (!character) {
            throw new Error(`Character not found: ${entry.characterId}`);
          }
        }
      }
      
      await this.schedulesStore.saveAll(schedules);
      
      // Re-register schedules with scheduler
      this.scheduler.registerSchedules(schedules);
    });

    ipcMain.handle('schedules:toggle', async (_, id: string, enabled: boolean) => {
      await this.schedulesStore.toggleSchedule(id, enabled);
      
      // Re-register schedules
      const schedules = this.schedulesStore.list();
      this.scheduler.registerSchedules(schedules);
    });

    // Runs
    ipcMain.handle('runs:test', async (_, entryId: string) => {
      if (!entryId?.trim()) {
        throw new Error('Entry ID is required');
      }
      
      // Find the entry
      const allEntries = this.schedulesStore.getAllEntries();
      const entry = allEntries.find(e => e.id === entryId);
      if (!entry) {
        throw new Error('Schedule entry not found');
      }
      
      // Get scenario and character
      const scenario = this.scenarioCatalog.findById(entry.scenarioId);
      const character = this.charactersStore.findById(entry.characterId);
      
      if (!scenario) {
        throw new Error('Scenario not found');
      }
      if (!character) {
        throw new Error('Character not found');
      }
      
      const runId = await this.processManager.startRun(
        entryId,
        scenario,
        character,
        entry.maxDurationMs
      );
      
      return { runId };
    });

    ipcMain.handle('runs:active', () => {
      return this.processManager.getActiveRuns();
    });

    ipcMain.handle('runs:upcoming', async (_, limit: number = 10) => {
      return this.scheduler.getUpcomingRuns(limit);
    });

    ipcMain.handle('runs:stop', async (_, runId: string) => {
      if (!runId?.trim()) {
        throw new Error('Run ID is required');
      }
      
      await this.processManager.stopRun(runId);
    });

    ipcMain.handle('runs:tail', async (_, runId: string, lines: number = 100) => {
      if (!runId?.trim()) {
        throw new Error('Run ID is required');
      }
      
      return this.processManager.getRunLogs(runId, lines);
    });

    // History
    ipcMain.handle('history:query', async (_, filter: HistoryFilter) => {
      return await this.runHistory.query(filter);
    });

    // Skip functionality
    ipcMain.handle('skip:set', async (_, scheduleId: string, entryId: string) => {
      return await this.scheduler.setRunSkipped(scheduleId, entryId);
    });

    ipcMain.handle('skip:clear', async (_, scheduleId: string, entryId: string) => {
      return await this.scheduler.clearRunSkipped(scheduleId, entryId);
    });

    ipcMain.handle('skip:list', async () => {
      return await this.scheduler.getSkippedRuns();
    });
  }

  setupEventForwarding(webContents: Electron.WebContents): void {
    // Forward scenario catalog events
    this.scenarioCatalog.on('catalog:updated', (scenarios) => {
      webContents.send('scenarios:updated', scenarios);
    });

    this.scenarioCatalog.on('catalog:error', (error) => {
      webContents.send('scenarios:error', error);
    });

    // Forward process events
    this.processManager.on('run:started', (data) => {
      webContents.send('run:started', data);
    });

    this.processManager.on('run:exit', (data) => {
      webContents.send('run:exit', data);
    });

    this.processManager.on('run:output', (data) => {
      webContents.send('run:output', data);
    });

    // Forward scheduler events
    this.scheduler.on('run:requested', async (data) => {
      try {
        const scenario = this.scenarioCatalog.findById(data.scenarioId);
        const character = this.charactersStore.findById(data.characterId);
        
        if (scenario && character) {
          await this.processManager.startRun(
            data.entryId,
            scenario,
            character,
            data.maxDurationMs
          );
        }
      } catch (error) {
        console.error('Failed to start scheduled run:', error);
      }
    });

    this.scheduler.on('run:kill-requested', async (data) => {
      try {
        await this.processManager.stopRun(data.runId);
      } catch (error) {
        console.error('Failed to kill run:', error);
      }
    });

    // Forward skip events to renderer for dashboard refresh
    this.scheduler.on('run:skipped', (data) => {
      webContents.send('run:skipped', data);
    });

    // Handle manual skips - record them in history
    this.scheduler.on('run:skipped', async (data) => {
      try {
        if (data.reason === 'manual-skip') {
          const scenario = this.scenarioCatalog.findById(data.scenarioId);
          const character = this.charactersStore.findById(data.characterId);
          
          
          if (scenario && character) {
            const skipRecord: RunRecord = {
              runId: `skip-${data.scheduleId}-${data.entryId}-${Date.now()}`,
              scheduleId: data.scheduleId,
              entryId: data.entryId,
              scenarioId: scenario.id,
              characterId: character.id,
              ts: new Date().toISOString(),
              status: 'skipped',
              durationMs: 0
            };
            
            await this.runHistory.appendRecord(skipRecord);
          } else {
            console.error('Failed to find scenario or character for skip record:', {
              scenarioId: data.scenarioId,
              characterId: data.characterId,
              scenarioFound: !!scenario,
              characterFound: !!character
            });
          }
        }
      } catch (error) {
        console.error('Failed to record manual skip:', error);
      }
    });
  }
}