## Stack

Any: React + Vite (recommended), or plain HTML/TS.

Keep state in the renderer; persist through IPC.

## Navigation

Dashboard | Schedules | Scenario Library | Characters & Credentials | Run History | Settings

## Screens
### Dashboard

* Active Runs table: Scenario, Character, Elapsed/Remaining, Status, Stop
* Next Up list: compute next 5 triggers (per enabled entries)
* Recent Failures quick list (links to history)

### Schedules

* Left: list of Schedules with enable toggles, next fire time, entry count
* Right: Schedule Editor
  - Name, Timezone (default to config)
    - Entries (repeatable):
        - Scenario (dropdown from api.scenarios.get)
        - Character (dropdown)
        - Cadence:
            - “Every N” (minutes/hours, integer input)
            - “Cron” (builder + raw input, validate expression)
            - (Optional) “Once at” ISO datetime
        - Duration (minutes)
        - Overlap policy (Skip / Queue / Kill previous)
        - Retries (max, backoffMs)
        - Test Run button → api.runs.test(entry.id)

    - Conflict hints:
        - If same character overlaps with other entries (rough check using simulated next fires)
    - Save → api.schedules.save(all) (atomic)

### Scenario Library

* Read-only list of scenarios (name, command preview, workingDir)
* Banner on validation errors with details
* Buttons: Reload, Open in Editor

### Characters & Credentials

* Credentials: list (id, label) + “Edit Secret” (modal: username/password → api.credentials.setSecret)
* Characters: list (name, credential), “Used in N entries” badges
* CRUD for characters; rebind credential

### Run History

* Filters: date range, scenario, character, status
* Table: start time, duration, scenario, character, result, exit code
* Row → drawer: stdout/stderr (collapsible), resolved command preview (mask secrets), reason

### Settings

* Scenarios file path (picker) + Watch toggle

* Default timezone (pre-filled “America/Phoenix”)
* Global concurrency limit
* Autostart on login
* Log retention (days)
* Open data folder; Export/Import zip