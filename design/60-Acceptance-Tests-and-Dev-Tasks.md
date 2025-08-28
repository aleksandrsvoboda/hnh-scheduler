## High-level acceptance

* ✅ App creates default data folder on first run with valid empty JSONs
* ✅ Can add credentials (labels) and store secrets (keytar)
* ✅ Can add characters bound to credentials
* ✅ Can import/watch scenarios.json and see it in UI
* ✅ Can create schedules & entries; validation blocks invalid forms
* ✅ Entries fire at expected times in chosen timezone
* ✅ Runs are killed at maxDurationMs with correct status
* ✅ Per-character overlap rules honored
* ✅ Run history records are appended & visible with filters
* ✅ All JSON writes are atomic and backed up
* ✅ Works on Windows/macOS/Linux

## Dev task list (ordered)
1. 
2. Bootstrap Electron (main, preload, renderer; nodeIntegration off)
3. JsonStore + specialized stores (config/credentials/characters/schedules/scenarios)
4. Migration & validation scaffolding (per file)
5. ScenarioCatalog watcher (chokidar + debounce)
6. CredentialVault (keytar) + fallback flag
7. ProcessManager (spawn, streams, watchdog, Windows taskkill)
8. Scheduler (cron/interval/once, locks, limits)
9. RunHistory (NDJSON append + retention)
10. IPC API + preload bridge
11. Renderer UI (Schedules editor, Library, Characters/Creds, History, Dashboard)
12. Packaging (electron-builder configs for Win/macOS/Linux)
13. QA passes: overlap policies, timezones, malformed files, large logs

## Unit/integration test ideas

* JSON load/save atomicity (rename swap)
* Schema migrations (snapshot tests)
* Cron parsing (known expressions)
* Overlap policies with synthetic tasks (fake child process)
* Timeout behavior (force kill path per OS)
* Log retention pruning