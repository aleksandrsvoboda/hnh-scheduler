## Responsibilities

- Load/validate/migrate JSON files

- Watch scenarios.json and broadcast updates

- Manage schedules (cron/interval/once)

- Spawn child processes; stream logs; enforce timeouts

- Per-character locking + concurrency caps

- Append to run-history; rotate & prune logs

- IPC (strict, no secrets to renderer)

## Modules
`/main/stores/json-store.ts`
- `class JsonStore<T>(filePath: string, defaultValue: T, schemaVersion: number)`
- Methods: `load()`, `saveAtomic(data)`, `backup(data)`, `validate(data)`, `migrate(data)`
- ebounce saves; ensure atomic rename
- Export specialized stores: `config-store.ts`, `schedules-store.ts`, `characters-store.ts`, `credentials-store.ts`, `scenarios-store.ts`

`/main/services/credential-vault.ts`
- Uses keytar
- `setSecret(credentialId, {username, password})`
- `getSecret(credentialId): Promise<{username:string,password:string}>`
- If keytar unavailable (fallback mode): store nothing; renderer must prompt on run (flag in config).

`/main/services/scenario-catalog.ts`
- Read from `config.scenariosFilePath`
- Validate unique `Scenario.id`
- Watch using `chokidar` (debounced)
- Emit `catalog:updated` via app-wide event bus

`/main/services/scheduler.ts`
- Register jobs per `ScheduleEntry`:
    - cron → `node-cron` with timezone
    - every → `setInterval`
    - once → `setTimeout`
- Enforce per-schedule `concurrencyLimit`
- Maintain per-character mutex map
- Overlap handling policy:
    - `skip`: ignore if running
    - `queue`: enqueue; start when free
    - `kill-previous`: send SIGINT then force kill previous, start new

`/main/services/process-manager.ts`

- `startRun(entryId)` resolves:
    - scenario + character + credentials
    - spawn with correct `cwd`, `env` (merge scenario.env + `APP_USER`, `APP_PASS`, `CHARACTER`)

- Log wiring:
    - stdout/stderr → event bus (`run:output`) + rolling file

- Timeout watchdog:
    - at `maxDurationMs`: send SIGINT; after 10s send hard kill (Windows: `taskkill /PID <pid> /T /F`)

- Emits lifecycle: `run:started`, `run:timeout`, `run:exit`
- Returns a `stop()` function for UI Stop button

`/main/services/run-history.ts`

- Append to `run-history/YYYY-MM-DD.jsonl`

- Prune old logs based on `config.logRetentionDays`

`/main/ipc.ts`

-Define all handlers (see 30-Preload-IPC)

-Validate inputs; never return secrets

`/main/app.ts`

- Boot order:
  1. Load config → resolve data paths

  1. Load credentials/characters/schedules

  1. Load scenarios (watch)

  1. Register schedules

  1. Create BrowserWindow + preload