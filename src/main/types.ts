// Base types from storage schema
export interface Config {
  schemaVersion: 1;
  globalConcurrencyLimit: number;
  autostartOnLogin: boolean;
  logRetentionDays: number;
  dataDir?: string;
  // Hafen game configuration
  javaPath?: string;
  hafenPath?: string;
  isJava18?: boolean;
  // Window management
  autoMinimizeWindow?: boolean;
  minimizeToTray?: boolean;
}

export interface ScenarioStep {
  id: string;
  params: Record<string, any>;
}

export interface Scenario {
  id: number;
  name: string;
  steps: ScenarioStep[];
}

export interface NurglingScenarios {
  scenarios: Scenario[];
}

export interface Area {
  id: number;
  name: string;
}

export interface NurglingAreas {
  areas: Area[];
}

export interface CredentialRef {
  id: string;
  label: string;
}

export interface CredentialsFile {
  schemaVersion: 1;
  credentials: CredentialRef[];
}

export interface Character {
  id: string;
  name: string;
  credentialId: string;
  meta?: Record<string, any>;
}

export interface CharactersFile {
  schemaVersion: 1;
  characters: Character[];
}

export type Cadence =
  | { type: "cron"; expression: string; startTimeISO?: string }
  | { type: "every"; unit: "minutes" | "hours"; n: number; startTimeISO?: string }
  | { type: "once"; atISO: string };

export type OverlapPolicy = "skip" | "queue" | "kill-previous";

export interface ScheduleEntry {
  id: string;
  scenarioId: number;
  characterId: string;
  cadence: Cadence;
  maxDurationMs: number;
  overlapPolicy: OverlapPolicy;
  retries?: { max: number; backoffMs: number };
  enabled: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  concurrencyLimit?: number;
  entries: ScheduleEntry[];
}

export interface SchedulesFile {
  schemaVersion: 1;
  schedules: Schedule[];
}

export interface RunRecord {
  ts: string;
  runId: string;
  entryId: string;
  scheduleId: string;
  scenarioId: number;
  characterId: string;
  status: "success" | "error" | "timeout" | "killed" | "skipped";
  exitCode?: number;
  signal?: string;
  durationMs: number;
  error?: string;
}

export interface ActiveRun {
  runId: string;
  entryId: string;
  pid: number;
  startedAt: string;
  elapsedMs: number;
  remainingMs: number;
}

export interface HistoryFilter {
  fromISO?: string;
  toISO?: string;
  scenarioId?: number;
  characterId?: string;
  status?: "success" | "error" | "timeout" | "killed";
}

export interface UpcomingRun {
  entryId: string;
  scheduleId: string;
  scenarioId: number;
  characterId: string;
  nextRunAt: string;
  cadenceType: string;
}