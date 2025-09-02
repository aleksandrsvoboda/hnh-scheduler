# HnH Scheduler

A cross-platform Electron desktop application that runs scenarios on a schedule using local JSON files. 100% local with no servers or external APIs.

## Features

- **Local-only storage** - All data stored in JSON files with atomic writes and rolling backups
- **Flexible scheduling** - Cron expressions, simple intervals, or one-time runs
- **Character management** - Bind credentials to characters with secure OS keychain storage
- **Process management** - Enforce max duration per run with graceful then hard termination
- **Concurrency control** - Per-character locking and configurable concurrency limits
- **Live updates** - Watch scenario files for changes with real-time UI updates
- **Rich UI** - Dashboard, schedule editor, run history, and settings management

## Usage:
Download package for your system from Releases section

Follow the usage guide: [Usage Guide](docs/starter-guide.md)

## Quick Start (dev)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── stores/     # JSON data stores
│   ├── services/   # Core business logic
│   └── app.ts      # Main application entry
├── preload/        # Secure IPC bridge
└── renderer/       # React UI components
```

## Architecture

- **Main Process**: Handles scheduling, process management, and data persistence
- **Renderer Process**: React-based UI with real-time updates
- **IPC Bridge**: Secure communication between main and renderer processes
- **Data Stores**: Atomic JSON file operations with schema validation and migration

## Key Components

- **Scheduler**: Manages cron/interval/once jobs with overlap policies
- **Process Manager**: Spawns and monitors child processes with timeout enforcement  
- **Credential Vault**: Secure credential storage using OS keychain (keytar)
- **Scenario Catalog**: Watches and validates external scenario definitions
- **Run History**: NDJSON logging with retention policies

## Configuration

The application stores configuration in:
- **Windows**: `%APPDATA%/Haven and Hearth/autorunner/`
- **macOS**: `~/Library/Application Support/Haven and Hearth/autorunner/`
- **Linux**: `~/.config/Haven and Hearth/autorunner/`

Files include:
- `config.json` - Application settings
- `credentials.json` - Credential references (no secrets)
- `characters.json` - Character definitions
- `schedules.json` - Schedule configurations
- `scenarios.json` - Scenario definitions (configurable location)
- `run-history/` - Daily NDJSON log files

## Building for Distribution

```bash
# Build for current platform
npm run dist

# Build for all platforms
npm run dist -- --win --mac --linux
```

## License

MIT License - see LICENSE file for details.