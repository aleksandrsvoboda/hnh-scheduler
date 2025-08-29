import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { ActiveRun, RunRecord, Scenario, Character } from '../types';
import { CredentialVault, CredentialSecret } from './credential-vault';

export interface ProcessRun {
  runId: string;
  entryId: string;
  process: ChildProcess;
  startedAt: Date;
  maxDurationMs: number;
  scenario: Scenario;
  character: Character;
  credentials: CredentialSecret | null;
  logBuffer: string[];
  timeout?: NodeJS.Timeout;
  gracefulTimeout?: NodeJS.Timeout;
  configFilePath?: string; // Path to temporary bot config file
}

export class ProcessManager extends EventEmitter {
  private activeRuns = new Map<string, ProcessRun>();
  private readonly MAX_LOG_BUFFER_LINES = 1000;

  constructor(private credentialVault: CredentialVault, private getConfig: () => any) {
    super();
  }

  async startRun(
    entryId: string,
    scenario: Scenario,
    character: Character,
    maxDurationMs: number
  ): Promise<string> {
    const runId = uuidv4();
    
    // Get credentials
    const credentials = await this.credentialVault.getSecret(character.credentialId);
    
    if (!credentials && !this.credentialVault.isFallbackMode()) {
      throw new Error(`No credentials found for character ${character.name}`);
    }

    // Create temporary bot config file (like the old Java app)
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    
    const tempDir = os.tmpdir();
    const configFileName = `bot_config-${runId}.json`;
    const configFilePath = path.join(tempDir, configFileName);
    
    // Write bot config file with credentials and scenario info
    const botConfig = {
      user: credentials?.username || '',
      password: credentials?.password || '', 
      character: character.name,
      scenarioId: scenario.id
    };
    
    fs.writeFileSync(configFilePath, JSON.stringify(botConfig, null, 2), 'utf8');

    // Use Hafen client command like the old app with configurable paths
    const config = this.getConfig();
    const javaCommand = config.javaPath || 'java';
    const hafenJarPath = config.hafenPath || 'hafen.jar';
    const isJava18 = config.isJava18 || false;
    
    let javaArgs;
    if (isJava18) {
      javaArgs = [
        '-jar', '-Xms4g', '-Xmx4g',
        '--add-exports', 'java.base/java.lang=ALL-UNNAMED',
        '--add-exports', 'java.desktop/sun.awt=ALL-UNNAMED', 
        '--add-exports', 'java.desktop/sun.java2d=ALL-UNNAMED',
        hafenJarPath,
        '-bots', configFilePath
      ];
    } else {
      javaArgs = [
        '-jar', hafenJarPath,
        '-bots', configFilePath
      ];
    }

    // Spawn process
    const childProcess = spawn(javaCommand, javaArgs, {
      cwd: process.cwd(), // Should be configurable to point to Hafen directory
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const run: ProcessRun = {
      runId,
      entryId,
      process: childProcess,
      startedAt: new Date(),
      maxDurationMs,
      scenario,
      character,
      credentials,
      logBuffer: [],
      configFilePath
    };

    this.activeRuns.set(runId, run);

    // Set up logging
    this.setupLogging(run);

    // Set up timeout
    this.setupTimeout(run);

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      this.handleProcessExit(runId, code, signal);
    });

    childProcess.on('error', (error) => {
      this.handleProcessError(runId, error);
    });

    this.emit('run:started', {
      runId,
      entryId,
      pid: childProcess.pid!,
      startedAt: run.startedAt.toISOString(),
      scenario: scenario.name,
      character: character.name
    });

    return runId;
  }

  async stopRun(runId: string): Promise<void> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    // Cancel timeouts
    if (run.timeout) {
      clearTimeout(run.timeout);
      run.timeout = undefined;
    }
    if (run.gracefulTimeout) {
      clearTimeout(run.gracefulTimeout);
      run.gracefulTimeout = undefined;
    }

    // Send SIGINT first (graceful)
    try {
      run.process.kill('SIGINT');
      
      // Force kill after 10 seconds if still running
      run.gracefulTimeout = setTimeout(() => {
        if (this.activeRuns.has(runId)) {
          this.forceKillProcess(run);
        }
      }, 10000);
    } catch (error) {
      console.error(`Failed to stop run ${runId}:`, error);
      this.forceKillProcess(run);
    }
  }

  private forceKillProcess(run: ProcessRun): void {
    try {
      if (os.platform() === 'win32') {
        // Windows: use taskkill
        spawn('taskkill', ['/PID', run.process.pid!.toString(), '/T', '/F'], {
          stdio: 'ignore'
        });
      } else {
        // Unix: use SIGKILL
        run.process.kill('SIGKILL');
      }
    } catch (error) {
      console.error(`Failed to force kill process ${run.process.pid}:`, error);
    }
  }

  private setupLogging(run: ProcessRun): void {
    const { process: childProcess, runId } = run;

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        this.addToLogBuffer(run, lines, 'stdout');
        this.emit('run:output', { runId, type: 'stdout', data: data.toString() });
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        this.addToLogBuffer(run, lines, 'stderr');
        this.emit('run:output', { runId, type: 'stderr', data: data.toString() });
      });
    }
  }

  private addToLogBuffer(run: ProcessRun, lines: string[], type: 'stdout' | 'stderr'): void {
    const timestamp = new Date().toISOString();
    
    for (const line of lines) {
      if (line.trim()) {
        run.logBuffer.push(`[${timestamp}] [${type}] ${line}`);
        
        // Keep buffer size manageable
        if (run.logBuffer.length > this.MAX_LOG_BUFFER_LINES) {
          run.logBuffer.shift();
        }
      }
    }
  }

  private setupTimeout(run: ProcessRun): void {
    run.timeout = setTimeout(() => {
      
      try {
        run.process.kill('SIGINT');
        this.emit('run:timeout', { runId: run.runId, stage: 'graceful' });
        
        // Force kill after 10 seconds
        run.gracefulTimeout = setTimeout(() => {
          this.forceKillProcess(run);
          this.emit('run:timeout', { runId: run.runId, stage: 'force' });
        }, 10000);
        
      } catch (error) {
        console.error(`Failed to timeout run ${run.runId}:`, error);
        this.forceKillProcess(run);
      }
    }, run.maxDurationMs);
  }

  private handleProcessExit(runId: string, code: number | null, signal: NodeJS.Signals | null): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    // Clean up timeouts
    if (run.timeout) {
      clearTimeout(run.timeout);
    }
    if (run.gracefulTimeout) {
      clearTimeout(run.gracefulTimeout);
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - run.startedAt.getTime();
    
    let status: RunRecord['status'] = 'success';
    if (signal === 'SIGINT' || signal === 'SIGKILL' || signal === 'SIGTERM') {
      status = durationMs >= run.maxDurationMs ? 'timeout' : 'killed';
    } else if (code !== 0) {
      status = 'error';
    }

    const record: RunRecord = {
      ts: endTime.toISOString(),
      runId,
      entryId: run.entryId,
      scheduleId: '', // Will be filled by caller
      scenarioId: run.scenario.id,
      characterId: run.character.id,
      status,
      exitCode: code || undefined,
      signal: signal || undefined,
      durationMs
    };

    // Clean up temporary config file
    if (run.configFilePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(run.configFilePath)) {
          fs.unlinkSync(run.configFilePath);
        }
      } catch (error) {
        console.error(`Failed to delete config file ${run.configFilePath}:`, error);
      }
    }

    this.activeRuns.delete(runId);

    this.emit('run:exit', {
      runId,
      record,
      logBuffer: run.logBuffer
    });
  }

  private handleProcessError(runId: string, error: Error): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    console.error(`Process error for run ${runId}:`, error);
    
    // Clean up timeouts
    if (run.timeout) {
      clearTimeout(run.timeout);
    }
    if (run.gracefulTimeout) {
      clearTimeout(run.gracefulTimeout);
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - run.startedAt.getTime();

    const record: RunRecord = {
      ts: endTime.toISOString(),
      runId,
      entryId: run.entryId,
      scheduleId: '', // Will be filled by caller
      scenarioId: run.scenario.id,
      characterId: run.character.id,
      status: 'error',
      durationMs,
      error: error.message
    };

    // Clean up temporary config file
    if (run.configFilePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(run.configFilePath)) {
          fs.unlinkSync(run.configFilePath);
        }
      } catch (error) {
        console.error(`Failed to delete config file ${run.configFilePath}:`, error);
      }
    }

    this.activeRuns.delete(runId);

    this.emit('run:error', {
      runId,
      error: error.message,
      record,
      logBuffer: run.logBuffer
    });
  }

  getActiveRuns(): ActiveRun[] {
    const now = Date.now();
    
    return Array.from(this.activeRuns.values()).map(run => ({
      runId: run.runId,
      entryId: run.entryId,
      pid: run.process.pid!,
      startedAt: run.startedAt.toISOString(),
      elapsedMs: now - run.startedAt.getTime(),
      remainingMs: Math.max(0, run.maxDurationMs - (now - run.startedAt.getTime()))
    }));
  }

  getRunLogs(runId: string, lines?: number): string {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const logLines = lines ? run.logBuffer.slice(-lines) : run.logBuffer;
    return logLines.join('\n');
  }

  isRunActive(runId: string): boolean {
    return this.activeRuns.has(runId);
  }
}