## App: HnH Scheduler (Electron, local-only)

A cross-platform Electron desktop app (Windows/macOS/Linux) that runs scenarios on a schedule using local JSON files. No servers or external APIs. Credentials stored locally via OS keychain (keytar). Processes are hard-stopped when their allotted time elapses.

## Goals

- 100% local storage (JSON + NDJSON logs)
- Schedules with cron or simple intervals
- Select character (bound to credentials) per schedule entry
- Enforce max duration per run (graceful then hard kill)
- Per-character lock + optional concurrency limits
- Watch scenarios file for live updates
- Atomic writes + rolling backups

## Non-Goals

- No remote APIs, no cloud sync
- No RDBMS; no background OS services
- No catch-up of missed runs by default

## Platforms

- Windows (NSIS installer or portable EXE)
- macOS (DMG)
- Linux (AppImage/DEB)

## Tech

- Electron (Main/Renderer, preload bridge), Node 18+
- node-cron, chokidar
- keytar (optional fallback noted later)
- fs/promises, child_process, events
- electron-builder