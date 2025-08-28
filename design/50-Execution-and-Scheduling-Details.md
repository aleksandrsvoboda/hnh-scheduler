## Job registration

- For each enabled `ScheduleEntry`:
    - `cron` → node-cron.schedule(expr, { timezone })
    - `every` → setInterval(periodMs)
    - `once` → setTimeout(at - now)

- Store clear functions for hot-reloading schedules after edits.

## Overlap & locks

- Per-character mutex:
    - If entry fires and character busy:
        - skip: do nothing
        - queue: place in FIFO queue per character
        - kill-previous: send SIGINT; after 10s force kill; start new run

- Per-schedule concurrencyLimit:
    - Count active runs for that schedule; if >= limit, hold/skip according to policy (default: queue)

## Process lifecycle

- Build env = {...process.env, ...scenario.env, APP_USER, APP_PASS, CHARACTER}
- spawn(scenario.command, scenario.args, { cwd: scenario.workingDir || process.cwd(), env })
- Wire stdout/stderr:
  - Buffer last N KB per run for UI tail
  - Stream to per-day log file

- Watchdog:
  - setTimeout(maxDurationMs) → try SIGINT
  - After 10s → hard kill (Windows: taskkill /PID <pid> /T /F; else SIGKILL)
- On exit:
  - Emit run:exit with code, signal, computed status
  - Append NDJSON record
  - Release lock; drain queue if any
  - Schedule retries if configured

## Error handling

- If scenarios.json invalid:
  - Keep last good catalog; show banner in UI with errors
- If credentials missing:
  - Fail run with clear reason; link to Characters screen
- If Java missing:
  - Provide “Java path” override in Settings; use absolute path if set