## Preload (`/preload/bridge.ts`)

Use `contextBridge.exposeInMainWorld('api', { ... })`. No nodeIntegration in renderer.

## IPC surface (channels & contracts)
```
// Settings
api.settings.get(): Promise<Config>
api.settings.set(patch: Partial<Config>): Promise<void>
api.app.openDataDir(): Promise<void>

// Scenarios
api.scenarios.get(): Promise<Scenario[]>
api.scenarios.openInEditor(): Promise<void>     // shell.openPath
api.scenarios.onUpdated(cb: () => void): Unsub  // events

// Credentials (no secrets returned)
api.credentials.list(): Promise<CredentialRef[]>
api.credentials.create(label: string): Promise<CredentialRef>
api.credentials.updateLabel(id: string, label: string): Promise<void>
api.credentials.delete(id: string): Promise<void>
api.credentials.setSecret(id: string, creds: {username: string; password: string}): Promise<void>

// Characters
api.characters.list(): Promise<Character[]>
api.characters.create(char: Omit<Character,"id">): Promise<Character>
api.characters.update(char: Character): Promise<void>
api.characters.delete(id: string): Promise<void>

// Schedules
api.schedules.list(): Promise<Schedule[]>
api.schedules.save(all: Schedule[]): Promise<void>  // whole-file write (atomic)
api.schedules.toggle(id: string, enabled: boolean): Promise<void>

// Runs
api.runs.test(entryId: string): Promise<{runId: string}>
api.runs.active(): Promise<Array<{runId:string;entryId:string;pid:number;startedAt:string;elapsedMs:number;remainingMs:number}>>
api.runs.stop(runId: string): Promise<void>
api.runs.tail(runId: string, lines: number): Promise<string> // reads buffered log

// History
type HistoryFilter = { fromISO?: string; toISO?: string; scenarioId?: string; characterId?: string; status?: "success"|"error"|"timeout"|"killed" }
api.history.query(filter: HistoryFilter): Promise<Array<any>>
```

## Rules

- Validate inputs; reject unknown ids
- Never expose secrets or full env
- Sanitize text streamed to UI