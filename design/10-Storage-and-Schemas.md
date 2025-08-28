## Storage root

Use `app.getPath('userData')` by default; allow override in Settings.

```
/Roaming/Haven and Hearth/autorunner
config.json
credentials.json            // labels only (no secrets)
characters.json
schedules.json
run-history/
YYYY-MM-DD.jsonl          // NDJSON (append-only)
.backups/
<file>.YYYY-MM-DDThh-mm-ssZ
```

```
/Roaming/Haven and Hearth/
scenarios.json              // separate location configurable; watched
```

## JSON file invariants

Each file includes schemaVersion.

Atomic writes: write *.tmp then rename.

After each save, write a copy into .backups/ with timestamp.

On load: validate, migrate by schemaVersion if needed.

## Schemas (TypeScript-like)
```
// config.json
type Config = {
schemaVersion: 1;
defaultTimezone: string;          // e.g., "America/Phoenix"
scenariosFilePath: string;        // absolute path to scenarios.json
globalConcurrencyLimit: number;   // default 3
autostartOnLogin: boolean;
logRetentionDays: number;         // e.g., 14
dataDir?: string;                 // optional override
};

// scenarios.json (read-only by app; edited by user)
type Scenario = {
id: string;
name: string;
description?: string;
command: string;                  // e.g., "java"
args?: string[];                  // e.g., ["-jar","n2-bot.jar","--scenario","x"]
workingDir?: string;              // cwd for the process
env?: Record<string,string>;      // additive
};
type ScenarioCatalog = { schemaVersion: 1; scenarios: Scenario[] };

// credentials.json (no secrets)
type CredentialRef = { id: string; label: string };
type CredentialsFile = { schemaVersion: 1; credentials: CredentialRef[] };

// characters.json
type Character = {
id: string;
name: string;
credentialId: string;             // references credentials.json -> id
meta?: Record<string, any>;
};
type CharactersFile = { schemaVersion: 1; characters: Character[] };

// schedules.json
type Cadence =
| { type: "cron"; expression: string }
| { type: "every"; unit: "minutes" | "hours"; n: number }
| { type: "once"; atISO: string };

type OverlapPolicy = "skip" | "queue" | "kill-previous";

type ScheduleEntry = {
id: string;
scenarioId: string;               // from ScenarioCatalog
characterId: string;              // from Characters
cadence: Cadence;
maxDurationMs: number;            // hard timebox
overlapPolicy: OverlapPolicy;
retries?: { max: number; backoffMs: number };
enabled: boolean;
};

type Schedule = {
id: string;
name: string;
timezone: string;                 // default from Config
enabled: boolean;
concurrencyLimit?: number;        // per-schedule
entries: ScheduleEntry[];
};

type SchedulesFile = { schemaVersion: 1; schedules: Schedule[] };
```
## Run history NDJSON

Each line: one completed (or timed-out) run.
```
{"ts":"2025-08-27T05:00:00Z","runId":"r-uuid","entryId":"entry-a","scheduleId":"sched-1","scenarioId":"scenario-x",
```