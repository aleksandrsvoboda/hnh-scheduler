import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigStore } from './stores/config-store';
import { CredentialsStore } from './stores/credentials-store';
import { CharactersStore } from './stores/characters-store';
import { SchedulesStore } from './stores/schedules-store';
import { ScenarioCatalog } from './services/scenario-catalog';
import { CredentialVault } from './services/credential-vault';
import { ProcessManager } from './services/process-manager';
import { RunHistory } from './services/run-history';
import { ScreenshotService } from './services/screenshot-service';
import { Scheduler } from './services/scheduler';
import { IPCManager } from './ipc';

class HnHSchedulerApp {
  private mainWindow?: BrowserWindow;
  private tray?: Tray;
  private trayUpdateInterval?: NodeJS.Timeout;
  public isQuitting = false;
  private configStore!: ConfigStore;
  private credentialsStore!: CredentialsStore;
  private charactersStore!: CharactersStore;
  private schedulesStore!: SchedulesStore;
  private scenarioCatalog!: ScenarioCatalog;
  private credentialVault!: CredentialVault;
  private processManager!: ProcessManager;
  private runHistory!: RunHistory;
  private screenshotService!: ScreenshotService;
  private scheduler!: Scheduler;
  private ipcManager!: IPCManager;

  async initialize(): Promise<void> {
    try {
      // 1. Load config and resolve data paths
      this.configStore = new ConfigStore();
      await this.configStore.load();
      const config = this.configStore.get();

      // Sync auto-startup state with OS (in case settings got out of sync)
      this.configStore.syncAutostartState();

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

      // Initialize screenshot service
      this.screenshotService = new ScreenshotService(dataDir);
      await this.screenshotService.initialize();

      this.processManager = new ProcessManager(
        this.credentialVault,
        () => this.configStore.get(),
        this.screenshotService
      );
      this.runHistory = new RunHistory(dataDir);
      await this.runHistory.initialize();

      this.scheduler = new Scheduler();

      // Set up scheduler event listeners for tray updates
      this.scheduler.on('run:requested', () => this.updateTrayMenuIfEnabled());
      this.scheduler.on('run:skipped', () => this.updateTrayMenuIfEnabled());
      this.scheduler.on('run:completed', () => this.updateTrayMenuIfEnabled());
      this.scheduler.on('run:error', () => this.updateTrayMenuIfEnabled());

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
        this.screenshotService,
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
    // Prune old logs and screenshots daily
    const pruneInterval = setInterval(async () => {
      try {
        const config = this.configStore.get();

        // Prune old run history logs
        await this.runHistory.pruneOldLogs(config.logRetentionDays);

        // Prune old screenshots (use screenshot retention days or fall back to log retention)
        const screenshotRetentionDays = config.screenshotRetentionDays ?? config.logRetentionDays;
        await this.screenshotService.pruneOldScreenshots(screenshotRetentionDays);

        // Clean up orphaned stack trace temp files (safety net)
        await this.cleanupOrphanedTempFiles();

      } catch (error) {
        console.error('Failed to prune old files:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Clean up on app quit
    app.on('before-quit', () => {
      clearInterval(pruneInterval);
    });
  }

  private async cleanupOrphanedTempFiles(): Promise<void> {
    try {
      const os = require('os');
      const tmpDir = os.tmpdir();
      const files = fs.readdirSync(tmpDir);

      // Find orphaned stack trace temp files older than 24 hours
      const orphanedFiles = files.filter(file =>
        file.startsWith('stack_trace-') &&
        (file.endsWith('.json') || file.endsWith('.json.tmp')) &&
        this.isFileOlderThan(path.join(tmpDir, file), 24 * 60 * 60 * 1000)
      );

      for (const file of orphanedFiles) {
        try {
          fs.unlinkSync(path.join(tmpDir, file));
          console.log(`Cleaned up orphaned stack trace file: ${file}`);
        } catch (error) {
          console.error(`Failed to cleanup orphaned file ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup orphaned temp files:', error);
    }
  }

  private isFileOlderThan(filePath: string, maxAgeMs: number): boolean {
    try {
      const stats = fs.statSync(filePath);
      return Date.now() - stats.mtime.getTime() > maxAgeMs;
    } catch {
      return true; // If we can't stat it, consider it old
    }
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

    // Create tray if enabled in config
    await this.setupTray();

    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting && this.shouldMinimizeToTray()) {
        event.preventDefault();
        this.hideWindow();
      }
      // If isQuitting is true or tray not enabled, allow normal close behavior
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

  private async setupTray(): Promise<void> {
    const config = await this.configStore.load();
    if (!config.minimizeToTray) {
      return; // Tray not enabled
    }

    try {
      // Resolve tray icon path with multiple fallback locations for production
      let trayIconPath: string;
      if (app.isPackaged) {
        const possiblePaths = [
          // First try root-level tray icon (most reliable)
          path.join(process.resourcesPath, 'app.asar.unpacked', 'tray.png'),
          path.join(process.resourcesPath, 'tray.png'),
          // Then try build directory in resources
          path.join(process.resourcesPath, 'build', 'tray.png'),
          path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'tray.png'),
          // Then try relative to current directory
          path.join(__dirname, '../tray.png'),
          path.join(__dirname, '../../tray.png'),
          path.join(__dirname, '../build/tray.png'),
          path.join(__dirname, '../../build/tray.png'),
          // Finally try main icon as tray icon
          path.join(process.resourcesPath, 'icon.png'),
          path.join(__dirname, '../icon.png'),
          path.join(__dirname, '../../icon.png')
        ];

        trayIconPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
      } else {
        trayIconPath = path.join(__dirname, '../../build/tray.png');
      }

      // Create tray icon with fallback handling
      let trayIcon = nativeImage.createFromPath(trayIconPath);

      // If tray icon is empty, try fallback to main icon
      if (trayIcon.isEmpty()) {
        const fallbackIconPath = app.isPackaged
          ? path.join(process.resourcesPath, 'icon.png')
          : path.join(__dirname, '../../icon.png');

        trayIcon = nativeImage.createFromPath(fallbackIconPath);
      }

      // Resize icon if it's too large (tray icons should be small)
      const iconSize = trayIcon.getSize();
      if (iconSize.width > 32 || iconSize.height > 32) {
        trayIcon = trayIcon.resize({ width: 22, height: 22 });
      }

      this.tray = new Tray(trayIcon);

      // Set tray tooltip
      this.tray.setToolTip('HnH Scheduler');

      // Create initial tray context menu
      this.updateTrayMenu();

      // Update tray menu every 30 seconds to keep times current
      this.trayUpdateInterval = setInterval(() => {
        this.updateTrayMenu();
      }, 30000);

      // Handle tray click to show/hide window
      this.tray.on('click', () => {
        if (this.mainWindow?.isVisible()) {
          this.hideWindow();
        } else {
          this.showWindow();
        }
      });

      // Handle double-click to show window (common pattern)
      this.tray.on('double-click', () => {
        this.showWindow();
      });

    } catch (error) {
      console.error('Failed to create tray:', error);
      // Tray creation failed, disable tray functionality
      this.tray = undefined;
    }
  }

  private shouldMinimizeToTray(): boolean {
    return this.tray !== undefined;
  }

  private hideWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
      // Hide from taskbar when minimized to tray
      if (process.platform !== 'darwin') {
        this.mainWindow.setSkipTaskbar(true);
      }
    }
  }

  private showWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      // Show in taskbar when restored
      if (process.platform !== 'darwin') {
        this.mainWindow.setSkipTaskbar(false);
      }
    }
  }

  private quitApp(): void {
    this.isQuitting = true;
    app.quit();
  }

  public isTrayEnabled(): boolean {
    const config = this.configStore?.get();
    return config?.minimizeToTray === true;
  }

  private updateTrayMenuIfEnabled(): void {
    if (this.isTrayEnabled() && this.tray) {
      this.updateTrayMenu();
    }
  }

  private updateTrayMenu(): void {
    if (!this.tray) return;

    try {
      // Get next 3 upcoming runs
      const upcomingRuns = this.scheduler?.getUpcomingRuns(3) || [];

      // Build menu items
      const menuItems: any[] = [
        {
          label: 'Show HnH Scheduler',
          click: () => {
            this.showWindow();
          }
        }
      ];

      // Add upcoming runs section if any exist
      if (upcomingRuns.length > 0) {
        menuItems.push({ type: 'separator' });

        // Add header for upcoming runs
        menuItems.push({
          label: 'Upcoming Runs:',
          enabled: false
        });

        // Add each upcoming run
        upcomingRuns.forEach(run => {
          // Get scenario name
          const scenarios = this.scenarioCatalog?.getScenarios() || [];
          const scenario = scenarios.find(s => s.id === run.scenarioId);
          const scenarioName = scenario?.name || `Scenario ${run.scenarioId}`;

          // Format time (show as HH:MM:SS)
          const runTime = new Date(run.nextRunAt);
          const timeString = runTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          menuItems.push({
            label: `${scenarioName} - ${timeString}`,
            enabled: false // Disabled - shows as grayed out, not clickable
          });
        });
      }

      // Add separator and quit option
      menuItems.push(
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            this.quitApp();
          }
        }
      );

      // Build and set the menu
      const contextMenu = Menu.buildFromTemplate(menuItems);
      this.tray.setContextMenu(contextMenu);

    } catch (error) {
      console.error('Failed to update tray menu:', error);

      // Fallback to basic menu
      const basicMenu = Menu.buildFromTemplate([
        {
          label: 'Show HnH Scheduler',
          click: () => {
            this.showWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            this.quitApp();
          }
        }
      ]);
      this.tray.setContextMenu(basicMenu);
    }
  }

  async cleanup(): Promise<void> {

    try {
      // Stop tray updates
      if (this.trayUpdateInterval) {
        clearInterval(this.trayUpdateInterval);
        this.trayUpdateInterval = undefined;
      }

      // Destroy tray
      if (this.tray) {
        this.tray.destroy();
        this.tray = undefined;
      }
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
  // On macOS, keep app running when all windows closed
  if (process.platform === 'darwin') {
    return;
  }

  // On other platforms, only quit if tray is not active
  if (!hnhApp.isTrayEnabled()) {
    app.quit();
  }
  // If tray is active, keep app running
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await hnhApp.createMainWindow();
  }
});

app.on('before-quit', async () => {
  hnhApp.isQuitting = true;
  await hnhApp.cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});