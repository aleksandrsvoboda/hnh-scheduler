import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { ConfigStore } from './stores/config-store';
import { CredentialsStore } from './stores/credentials-store';
import { CharactersStore } from './stores/characters-store';
import { SchedulesStore } from './stores/schedules-store';
import { ScenarioCatalog } from './services/scenario-catalog';
import { CredentialVault } from './services/credential-vault';
import { ProcessManager } from './services/process-manager';
import { RunHistory } from './services/run-history';
import { Scheduler } from './services/scheduler';
import { IPCManager } from './ipc';

class HnHSchedulerApp {
  private mainWindow?: BrowserWindow;
  private configStore!: ConfigStore;
  private credentialsStore!: CredentialsStore;
  private charactersStore!: CharactersStore;
  private schedulesStore!: SchedulesStore;
  private scenarioCatalog!: ScenarioCatalog;
  private credentialVault!: CredentialVault;
  private processManager!: ProcessManager;
  private runHistory!: RunHistory;
  private scheduler!: Scheduler;
  private ipcManager!: IPCManager;

  async initialize(): Promise<void> {
    try {
      // 1. Load config and resolve data paths
      this.configStore = new ConfigStore();
      await this.configStore.load();
      const config = this.configStore.get();

      const dataDir = config.dataDir || app.getPath('userData');

      // 2. Load credentials, characters, and schedules
      this.credentialsStore = new CredentialsStore(dataDir);
      await this.credentialsStore.load();

      this.charactersStore = new CharactersStore(dataDir);
      await this.charactersStore.load();

      this.schedulesStore = new SchedulesStore(dataDir);
      await this.schedulesStore.load();

      // 3. Load scenarios (watch for changes)
      this.scenarioCatalog = new ScenarioCatalog();
      await this.scenarioCatalog.initialize();

      // 4. Initialize services
      this.credentialVault = new CredentialVault();
      this.processManager = new ProcessManager(this.credentialVault, () => this.configStore.get());
      this.runHistory = new RunHistory(dataDir);
      await this.runHistory.initialize();

      this.scheduler = new Scheduler();

      // 5. Set up IPC (will be updated with window reference later)
      this.ipcManager = new IPCManager(
        this.configStore,
        this.credentialsStore,
        this.charactersStore,
        this.schedulesStore,
        this.scenarioCatalog,
        this.credentialVault,
        this.processManager,
        this.runHistory,
        this.scheduler
      );

      // 6. Register schedules
      const schedules = this.schedulesStore.getEnabledSchedules();
      this.scheduler.registerSchedules(schedules);

      // 7. Set up event handlers
      this.setupEventHandlers();

    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Handle process run completions
    this.processManager.on('run:exit', async (data) => {
      const { runId, record, logBuffer } = data;
      
      try {
        // Save to run history
        await this.runHistory.appendRecord(record);
        
        // Notify scheduler
        this.scheduler.onRunCompleted(runId, record.entryId);
        
      } catch (error) {
        console.error(`Failed to handle run exit for ${runId}:`, error);
      }
    });

    // Handle credential vault fallback mode
    this.credentialVault.on('fallback-mode', (enabled) => {
      if (enabled) {
        console.warn('Credential vault is in fallback mode - secrets will not be stored');
      }
    });

    // Handle scenario catalog errors
    this.scenarioCatalog.on('catalog:error', (error) => {
      console.error('Scenario catalog error:', error);
    });

    // Periodic maintenance
    this.schedulePeriodicTasks();
  }

  private schedulePeriodicTasks(): void {
    // Prune old logs daily
    const pruneInterval = setInterval(async () => {
      try {
        const config = this.configStore.get();
        await this.runHistory.pruneOldLogs(config.logRetentionDays);
      } catch (error) {
        console.error('Failed to prune old logs:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Clean up on app quit
    app.on('before-quit', () => {
      clearInterval(pruneInterval);
    });
  }

  async createMainWindow(): Promise<void> {
    const preloadPath = path.resolve(__dirname, '../preload/bridge.js');
    
    // Check if preload file exists
    try {
      const fs = require('fs');
      if (fs.existsSync(preloadPath)) {
      } else {
        console.error('✗ Preload script does not exist at:', preloadPath);
        // Try alternative path
        const altPath = path.resolve(__dirname, '../../dist/preload/bridge.js');
        if (fs.existsSync(altPath)) {
        }
      }
    } catch (error) {
      console.error('Error checking preload script:', error);
    }

    
    // Resolve icon path for both development and production
    const iconPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '../../icon.png');
    
    const windowConfig: any = {
      width: 1200,
      height: 800,
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
      },
      show: false, // Show after ready
    };

    // Platform-specific window styling
    if (process.platform === 'win32') {
      // Windows: Custom frameless window
      windowConfig.frame = false;
    } else if (process.platform === 'darwin') {
      // macOS: Keep native traffic lights, hide title bar
      windowConfig.titleBarStyle = 'hiddenInset';
    } else {
      // Linux: Standard frame
      windowConfig.frame = true;
    }

    this.mainWindow = new BrowserWindow(windowConfig);

    // Update IPC manager with window reference for window controls
    this.ipcManager.setMainWindow(this.mainWindow);

    // Set up IPC event forwarding
    if (this.ipcManager && this.mainWindow.webContents) {
      this.ipcManager.setupEventForwarding(this.mainWindow.webContents);
    }

    // Load the renderer
    if (app.isPackaged) {
      // Production: load from built files inside asar
      
      // For asar-packaged apps, use path relative to asar root
      const rendererPath = path.join(__dirname, '../renderer/index.html');
      
      try {
        await this.mainWindow.loadFile(rendererPath);
      } catch (error) {
        console.error('Failed to load renderer from asar:', error);
        // Fallback: try loading a simple HTML string
        await this.mainWindow.loadURL('data:text/html,<h1>Loading Error</h1><p>Failed to load renderer</p>');
      }
    } else {
      // Development: load from Vite dev server
      await this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    }

    // Show window immediately in development for debugging
    if (!app.isPackaged) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }

    this.mainWindow.once('ready-to-show', () => {
      if (app.isPackaged) {
        this.mainWindow?.show();
        this.mainWindow?.focus();
      }
    });

    this.mainWindow.on('close', (event) => {
      // Allow normal close behavior - quit the app when window closes
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = undefined;
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
    });
  }

  async cleanup(): Promise<void> {
    
    try {
      // Stop scheduler
      if (this.scheduler) {
        this.scheduler.clearAllJobs();
      }

      // Stop scenario catalog watcher
      if (this.scenarioCatalog) {
        await this.scenarioCatalog.destroy();
      }

      // Stop any active runs
      if (this.processManager) {
        const activeRuns = this.processManager.getActiveRuns();
        for (const run of activeRuns) {
          try {
            await this.processManager.stopRun(run.runId);
          } catch (error) {
            console.error(`Failed to stop run ${run.runId}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Application lifecycle
const hnhApp = new HnHSchedulerApp();

app.whenReady().then(async () => {
  try {
    await hnhApp.initialize();
    await hnhApp.createMainWindow();

    // Remove default menu on Windows/Linux
    if (process.platform !== 'darwin') {
      Menu.setApplicationMenu(null);
    }
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await hnhApp.createMainWindow();
  }
});

app.on('before-quit', async () => {
  await hnhApp.cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});