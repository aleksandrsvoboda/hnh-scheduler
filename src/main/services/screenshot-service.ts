import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// Use node-screenshots for cross-platform window capture
const Screenshots = require('node-screenshots');

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ScreenshotOptions {
  runId: string;
  targetWindowTitle?: string;
  targetProcessName?: string;
  timeout?: number; // milliseconds
}

export class ScreenshotService extends EventEmitter {
  private screenshotDir: string;

  constructor(dataDir: string) {
    super();
    this.screenshotDir = path.join(dataDir, 'screenshots');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      console.log('[ScreenshotService] Initialized screenshot directory:', this.screenshotDir);
    } catch (error) {
      console.error('[ScreenshotService] Failed to create screenshot directory:', error);
      throw error;
    }
  }

  async captureTimeoutScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeout || 3000; // 3 second default timeout

    try {
      console.log('[ScreenshotService] Starting timeout screenshot capture for run:', options.runId);

      // Create date-based subdirectory
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayDir = path.join(this.screenshotDir, dateStr);
      await fs.mkdir(dayDir, { recursive: true });

      // Generate filename
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      const filename = `${options.runId}-timeout-${timestamp}.png`;
      const filePath = path.join(dayDir, filename);

      // Find target window with timeout
      const window = await this.findTargetWindow(options, timeoutMs);
      if (!window) {
        return {
          success: false,
          error: 'Target window not found'
        };
      }

      // Capture screenshot with remaining timeout
      const elapsed = Date.now() - startTime;
      const remainingTimeout = Math.max(1000, timeoutMs - elapsed); // At least 1 second for capture

      const screenshot = await this.captureWindowScreenshot(window, remainingTimeout);
      if (!screenshot) {
        return {
          success: false,
          error: 'Failed to capture screenshot'
        };
      }

      // Save screenshot to file
      await fs.writeFile(filePath, screenshot);

      const relativePath = path.relative(this.screenshotDir, filePath);
      console.log('[ScreenshotService] Screenshot saved successfully:', relativePath);

      this.emit('screenshot:captured', {
        runId: options.runId,
        filePath: relativePath
      });

      return {
        success: true,
        filePath: relativePath
      };

    } catch (error) {
      const errorMessage = `Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[ScreenshotService]', errorMessage);

      this.emit('screenshot:error', {
        runId: options.runId,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async findTargetWindow(options: ScreenshotOptions, timeoutMs: number): Promise<any> {
    const startTime = Date.now();
    const searchPatterns = [
      // Haven and Hearth window title patterns
      options.targetWindowTitle || 'Haven and Hearth',
      'Haven & Hearth',
      'HnH',
      'Hafen',
      // Java process patterns
      'java',
      'javaw'
    ];

    while (Date.now() - startTime < timeoutMs) {
      try {
        const windows = Screenshots.Window.all();

        // Try to find window by title first (most accurate)
        for (const pattern of searchPatterns) {
          const matchingWindows = windows.filter((window: any) => {
            try {
              const title = window.title?.toLowerCase() || '';
              const processName = window.processName?.toLowerCase() || '';

              return title.includes(pattern.toLowerCase()) ||
                     processName.includes(pattern.toLowerCase());
            } catch (error) {
              return false;
            }
          });

          if (matchingWindows.length > 0) {
            const targetWindow = matchingWindows[0];

            console.log('[ScreenshotService] Found target window:', {
              title: targetWindow.title,
              processName: targetWindow.processName,
              id: targetWindow.id
            });

            return targetWindow;
          }
        }

        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn('[ScreenshotService] Error during window search:', error);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.warn('[ScreenshotService] No matching window found after timeout');
    return null;
  }

  private async captureWindowScreenshot(window: any, timeoutMs: number): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('[ScreenshotService] Screenshot capture timed out');
        resolve(null);
      }, timeoutMs);

      try {
        // Small delay to ensure window is ready
        setTimeout(() => {
          try {
            const screenshot = window.captureImageSync();
            clearTimeout(timeoutId);

            if (screenshot) {
              const pngBuffer = screenshot.toPngSync();
              if (pngBuffer && pngBuffer.length > 0) {
                resolve(pngBuffer);
              } else {
                console.warn('[ScreenshotService] Screenshot capture returned empty data');
                resolve(null);
              }
            } else {
              console.warn('[ScreenshotService] Screenshot capture returned null');
              resolve(null);
            }
          } catch (error) {
            console.error('[ScreenshotService] Error during window capture:', error);
            clearTimeout(timeoutId);
            resolve(null);
          }
        }, 100);
      } catch (error) {
        console.error('[ScreenshotService] Error preparing window for capture:', error);
        clearTimeout(timeoutId);
        resolve(null);
      }
    });
  }

  async pruneOldScreenshots(retentionDays: number): Promise<void> {
    try {
      const directories = await fs.readdir(this.screenshotDir, { withFileTypes: true });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const dirent of directories) {
        if (dirent.isDirectory() && dirent.name.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dirDate = new Date(dirent.name);

          if (dirDate < cutoffDate) {
            const dirPath = path.join(this.screenshotDir, dirent.name);

            try {
              // Delete all files in the directory
              const files = await fs.readdir(dirPath);
              for (const file of files) {
                await fs.unlink(path.join(dirPath, file));
                deletedCount++;
              }

              // Remove the empty directory
              await fs.rmdir(dirPath);
              console.log('[ScreenshotService] Pruned screenshot directory:', dirent.name);
            } catch (error) {
              console.error(`[ScreenshotService] Failed to prune directory ${dirent.name}:`, error);
            }
          }
        }
      }

      if (deletedCount > 0) {
        this.emit('pruned', { deletedCount, retentionDays });
        console.log(`[ScreenshotService] Pruned ${deletedCount} old screenshot(s)`);
      }
    } catch (error) {
      console.error('[ScreenshotService] Failed to prune old screenshots:', error);
      this.emit('prune:error', error);
    }
  }

  getScreenshotPath(relativePath: string): string {
    return path.join(this.screenshotDir, relativePath);
  }

  async getScreenshotStats(days: number = 7): Promise<{
    totalScreenshots: number;
    totalSizeMB: number;
    oldestDate: string | null;
    newestDate: string | null;
  }> {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      let totalCount = 0;
      let totalSizeBytes = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      const directories = await fs.readdir(this.screenshotDir, { withFileTypes: true });

      for (const dirent of directories) {
        if (dirent.isDirectory() && dirent.name.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dirDate = new Date(dirent.name);

          if (dirDate >= fromDate) {
            const dirPath = path.join(this.screenshotDir, dirent.name);

            try {
              const files = await fs.readdir(dirPath);

              for (const file of files) {
                if (file.endsWith('.png')) {
                  const filePath = path.join(dirPath, file);
                  const stats = await fs.stat(filePath);

                  totalCount++;
                  totalSizeBytes += stats.size;

                  if (!oldestDate || dirDate < oldestDate) {
                    oldestDate = dirDate;
                  }
                  if (!newestDate || dirDate > newestDate) {
                    newestDate = dirDate;
                  }
                }
              }
            } catch (error) {
              console.warn(`[ScreenshotService] Failed to read directory ${dirent.name}:`, error);
            }
          }
        }
      }

      return {
        totalScreenshots: totalCount,
        totalSizeMB: Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100,
        oldestDate: oldestDate?.toISOString().split('T')[0] || null,
        newestDate: newestDate?.toISOString().split('T')[0] || null
      };
    } catch (error) {
      console.error('[ScreenshotService] Failed to get screenshot stats:', error);
      return {
        totalScreenshots: 0,
        totalSizeMB: 0,
        oldestDate: null,
        newestDate: null
      };
    }
  }
}