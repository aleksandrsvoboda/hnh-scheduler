## Stack

Any: React + Vite (recommended), or plain HTML/TS.

Keep state in the renderer; persist through IPC.

## Navigation

Dashboard | Schedules | Scenario Library | Characters & Accounts | Run History | Settings

## Screens
### Dashboard

* **Schedule Grid**: Visual 24-hour timeline showing upcoming runs for all schedules
* **Upcoming Runs table**: Next run per scenario (up to 5), with Skip toggle and InfoTooltip
  - Columns: Scenario, Character, Next Run, Type, Skip
  - Skip toggle has InfoTooltip: "Toggle to skip the next occurrence of this scheduled run"
* **Active Runs table**: Scenario, Character, Elapsed/Remaining, Status, Stop button
* **Recent Failures (Last 24h)**: Quick list showing recent errors with details

### Schedules

* **Left sidebar**: list of Schedules with enable toggles, entry count, concurrency info
* **Right**: Schedule Editor
  - **Schedule Settings**:
    - Name (inline editable)
    - Concurrency Limit with InfoTooltip: "Maximum number of runs that can execute simultaneously for this schedule. Leave empty for no limit."
  - **Schedule Scenarios**:
    - Collapsible entries showing scenario name, character, timing overview
    - **Actions**: Blue "▶ Test" button (was gray, now prominent), Red "Delete" button
    - **Expanded view** shows:
        - Scenario (dropdown from api.scenarios.get)
        - Character (dropdown with validation)
        - Cadence: "Every N" (minutes/hours), "Cron", "Once at" datetime
        - Duration (minutes), Overlap policy (Skip/Queue/Kill previous)
        - Enable/disable toggle with explanation
    - **Save All button**: Prominent green button with 💾 emoji, positioned top-right

### Scenario Library

* **Header Controls**: "Expand All", "Collapse All", "Reload" buttons for batch operations
* **Scenario Table**: ID, Name, Steps count (clickable with ▶/▼ indicators)
* **Expandable Step Details**: 
  - Collapsed view shows only first step + count ("...and N more steps")
  - Expanded view shows all steps with parameters
  - Individual expand/collapse per scenario
* **Error Handling**: Banner on validation errors with details
* **Scrollable container** for large scenario lists

### Characters & Credentials

* Credentials: list (id, label) + “Edit Secret” (modal: username/password → api.credentials.setSecret)
* Characters: list (name, credential), “Used in N entries” badges
* CRUD for characters; rebind credential

### Run History

* **Filters Panel**: Date range, scenario dropdown, character dropdown, status dropdown, "Clear Filters" button
* **Results Table**: Time, Scenario, Character, Status (with colored badges), Duration, Exit Code
* **Removed**: Empty error column (was always empty, created clutter)
* **Scrollable**: Fixed height container with sticky header for long history lists
* **Status Styling**: Color-coded status badges (green success, red error, yellow timeout, blue killed)

### Settings

* Scenarios file path (picker) + Watch toggle

* Default timezone (pre-filled "America/Phoenix")
* Global concurrency limit
* Autostart on login
* Log retention (days)
* Open data folder; Export/Import zip

## UI Components

### InfoTooltip Component
* **Reusable help system** with question mark icons (?)
* **Smart positioning**: Automatically adjusts to avoid window edges and sidebar cutoffs
* **Clean design**: Rounded corners, no arrows, proper width (280px)
* **Usage**: Embedded in labels next to complex terms
* **Examples**: 
  - Skip toggle: explains it skips single upcoming run
  - Concurrency Limit: explains simultaneous execution limits
* **Styling**: Dark background (#1f2937), white text, subtle shadow