# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HnH Scheduler is a cross-platform Electron desktop application that runs Haven and Hearth Nurgling scenarios on a schedule. It reads scenarios from the existing `scenarios.nurgling.json` file and runs them via the Nurgling client. It's 100% local with no servers or external APIs, using OS keychain for credential storage via keytar.

## Build Commands

```bash
npm run dev          # Development with vite-electron
npm run build        # Build TypeScript + Vite + electron-builder
tsc -b              # TypeScript compilation only
```

## Architecture

### Main Process Structure
- `/main/stores/` - JSON data stores with atomic writes and migrations
  - `json-store.ts` - Base class with load/save/validate/migrate methods
  - Specialized stores: config, schedules, characters, credentials, scenarios
- `/main/services/` - Core business logic
  - `credential-vault.ts` - Keytar integration for secure credential storage
  - `scenario-catalog.ts` - Watches scenarios.json with chokidar, debounced updates
  - `scheduler.ts` - Manages cron/interval/once jobs with per-character locking
  - `process-manager.ts` - Spawns child processes, enforces timeouts, handles Windows taskkill
  - `run-history.ts` - NDJSON logging with retention policies

### Key Patterns
- All JSON writes are atomic (rename swap) with rolling backups
- Per-character mutex locking prevents concurrent runs for same character
- Overlap policies: skip, queue, or kill-previous
- Timeout enforcement: SIGINT then hard kill after 10s (Windows uses taskkill /PID /T /F)
- Event-driven architecture with app-wide event bus for run lifecycle

### Data Flow
1. Boot order: config → credentials/characters/schedules → scenarios (watch) → register schedules → create UI
2. Scheduler triggers → process-manager spawns Nurgling client with scenario ID → logs to run-history + real-time events
3. Scenario file changes → catalog updates → UI refreshes

### Nurgling Integration
- Scenarios are read from `scenarios.nurgling.json` (typically in `%APPDATA%/Haven and Hearth/`)
- Each scenario has numeric ID, name, and array of steps with parameters
- Process execution: `java -jar Nurgling.jar --scenario <id>` with credentials in environment variables
- Environment variables: APP_USER, APP_PASS, CHARACTER

### IPC Security
- Strict input validation in `/main/ipc.ts`
- No secrets returned to renderer process
- Preload bridge isolates renderer from Node.js APIs

### Platform Support
- Windows: NSIS installer + portable EXE
- macOS: DMG (optional signing/notarization)
- Linux: AppImage + DEB

## Development Notes

- Uses TypeScript with strict validation
- Credentials stored via keytar (fallback mode if unavailable)
- Process spawning includes environment merging (scenario.env + APP_USER/APP_PASS/CHARACTER)
- Log files: `run-history/YYYY-MM-DD.jsonl` format with configurable retention
- Timezone-aware cron scheduling with node-cron