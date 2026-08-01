# LottoOps Wireframe Layout Specs
Prepared for MARIONOVA PARTNERS LIMITED
Product: LottoOps
Companion standard: LOTTOOPS_ENTERPRISE_UX_BLUEPRINT.md

## 1. Scope
This document defines wireframe-level page layouts for LottoOps enterprise screens.

Primary design goals:
1. Fast repetitive operations
2. Minimal click paths
3. Keyboard-first and barcode-first interaction
4. No unnecessary scrolling at 1920x1080

## 2. Global Shell Template
All primary operational pages use the same shell:
1. Header (52px)
2. Toolbar (48px)
3. Main Work Area (remaining height)
4. Status Bar (42px)

## 3. Shared Zones and Behavior

### 3.1 Header
Contains:
1. Page title and concise subtitle
2. Context badges: Store, Terminal, User Role, Shift status
3. Top-right quick controls: Notifications, Help, User menu

### 3.2 Toolbar
Contains:
1. Left zone: Search, filters, date/time presets, view toggle
2. Center zone: Optional workflow step indicator
3. Right zone: Primary action, secondary actions, export/print

### 3.3 Main Work Area
Contains one of:
1. High-density data grid
2. Two-pane operational workspace
3. Step workflow area with fixed summary rail

### 3.4 Status Bar
Contains:
1. Left: live operational context
2. Center: key metrics and sync status
3. Right: fast actions and save state

## 4. Wireframe Specs by Page

## 4.1 Login
File: src/app/login/page.tsx

Layout:
1. Centered compact auth panel
2. Right-side terminal and session guidance panel
3. Bottom strip for support contact and environment indicator

Primary actions:
1. Sign In
2. Forgot Password
3. Switch Store (if enabled)

Keyboard flow:
1. Focus starts at email
2. Tab sequence: email > password > sign in
3. Enter submits
4. Esc clears password field

## 4.2 Setup
File: src/app/setup/page.tsx

Layout:
1. Header with setup stage and progress percent
2. Left step rail: company, store, timezone, owner, review
3. Main form area in two columns max
4. Bottom status bar with Save Draft and Continue

Primary actions:
1. Save Draft
2. Continue
3. Back
4. Complete Setup

## 4.3 Dashboard Home
File: src/app/(dashboard)/page.tsx

Layout:
1. Header with role badge and shift state
2. Toolbar with quick search and action shortcuts
3. Main split:
   1. Left: compact action control panel
   2. Right: alerts, notifications, and current shift summary
4. Status bar with sync, terminal, and open tasks count

Employee view modules:
1. Receive Shipment
2. Activate Pack
3. Open Shift
4. Close Shift
5. Inventory Lookup
6. Current Shift
7. Today Sales
8. Notifications

Manager view modules:
1. Sales summary
2. Revenue
3. Inventory status
4. Shift status
5. Employees working
6. Exception alerts

Executive view modules:
1. Company performance
2. Regional performance
3. Store comparison
4. Revenue and profit
5. Forecasts and AI insights

## 4.4 Shifts
File: src/app/(dashboard)/shifts/page.tsx

Layout:
1. Header with shift state and elapsed timer
2. Toolbar: terminal selector, shift filter, refresh, save, close
3. Main split:
   1. Left fixed rail (300px): shift metrics and event feed
   2. Right fluid pane: reconciliation data grid
4. Status bar: totals, last save, pending edits, quick commit

Grid columns:
1. Slot
2. Game
3. Pack Serial
4. Beginning Ticket
5. Current Ticket editable
6. Tickets Sold auto
7. Revenue auto
8. Exception flag

Keyboard flow:
1. Arrow keys navigate cells
2. Enter edits current ticket
3. Ctrl+S saves
4. Alt+C closes shift

## 4.5 Inventory Back Stock
File: src/app/(dashboard)/inventory/page.tsx

Layout:
1. Header with back stock totals
2. Toolbar: search, filters, bulk actions, receive shipment
3. Main: high-density data grid with inline row actions
4. Inline right-side action drawer on row focus
5. Status bar: selected rows, last scan, pending actions

Grid columns:
1. Select checkbox
2. Game Number
3. Pack Serial
4. Ticket Price
5. Quantity
6. Received Date
7. Status
8. Actions

Primary row actions:
1. Activate
2. Remove
3. View Details

## 4.6 Inventory Active
File: src/app/(dashboard)/inventory/active/page.tsx

Layout:
1. Header with active totals and display occupancy
2. Toolbar: search, status filters, slot filters, bulk actions
3. Main: compact data grid
4. Status bar: active count, low ticket alerts, quick remove

Grid columns:
1. Slot
2. Game
3. Pack Serial
4. Current Ticket
5. Ticket Price
6. Activated At
7. Status
8. Actions

## 4.7 Inventory Live Scan
File: src/app/(dashboard)/inventory/live-scan/page.tsx

Layout:
1. Header with terminal badge and scan mode
2. Toolbar: shift selector, scanner mode, clear queue, refresh
3. Main two-pane:
   1. Left: large persistent barcode input and live result panel
   2. Right: sales tracker and recent scan queue
4. Status bar: scan throughput, errors, sync state, undo prompt

Key behavior:
1. Scan input auto-focus on load
2. Focus auto-restores after every scan
3. Inline success or error feedback only

## 4.8 Inventory Receive
File: src/app/(dashboard)/inventory/receive/page.tsx

Layout:
1. Header with shipment workflow stage and shipment id
2. Toolbar: step controls and quick validation checks
3. Main split:
   1. Left fixed rail: shipment summary and expected versus scanned
   2. Right dynamic pane: current step content
4. Status bar: save draft, validation state, next action

Step content:
1. Invoice and metadata
2. Scan packs
3. Review and corrections
4. Confirm and receipt

## 4.9 Inventory Returned
File: src/app/(dashboard)/inventory/returned/page.tsx

Layout:
1. Header with returned totals
2. Toolbar: reason filters, date range, user filter, export
3. Main: grouped returned data grid
4. Status bar: current filter context and export status

Grid columns:
1. Removed Date
2. Pack Serial
3. Game
4. Reason
5. Removed By
6. Notes
7. Actions

## 4.10 Pack Detail
File: src/app/(dashboard)/inventory/packs/[id]/page.tsx

Layout:
1. Header with pack identity and status
2. Toolbar: print, copy serial, assign action, timeline filters
3. Main three-pane:
   1. Left: pack summary card
   2. Center: lifecycle timeline with pagination
   3. Right: related packs and exceptions
4. Status bar: last movement, open issues, quick actions

## 4.11 Display Slots
File: src/app/(dashboard)/display-slots/page.tsx

Layout:
1. Header with total slots and occupancy
2. Toolbar: slot filters, bulk assign, bulk clear, print manifest
3. Main two-pane:
   1. Left: dense slot list/grid
   2. Right: selected slot detail and assignment drawer
4. Status bar: occupied, empty, low-ticket slots

Slot row fields:
1. Slot Number
2. Current Pack
3. Game
4. Ticket Position
5. Status
6. Actions

## 4.12 Games
File: src/app/(dashboard)/games/page.tsx

Layout:
1. Header with game catalog stats
2. Toolbar: search, game type filters, sync, import preview
3. Main: game catalog data grid
4. Right rail optional: sync history and status timeline
5. Status bar: last sync, pending review count

Grid columns:
1. Game Number
2. Name
3. Type
4. Ticket Price
5. Tickets Per Pack
6. Active Packs
7. Status
8. Actions

## 4.13 Reports
File: src/app/(dashboard)/reports/page.tsx

Layout:
1. Header with report scope and period
2. Toolbar: global date range, store and terminal filter, export menu
3. Main tabbed workspace:
   1. Financial
   2. Inventory
   3. Activity
   4. Custom
4. Status bar: last refresh, active filters, export queue status

Report design rules:
1. No long stacked report cards
2. One active report viewport at a time
3. Local internal scrolling for long tables only

## 4.14 Sales
File: src/app/(dashboard)/sales/page.tsx

Layout:
1. Header with current sales window
2. Toolbar: date presets, game filter, print and export
3. Main split:
   1. Left: current shift sales grid and adjustments panel
   2. Right: summary KPI stack and anomaly strip
4. Status bar: totals, discrepancies, last reconciliation

## 4.15 Settings Root
File: src/app/(dashboard)/settings/page.tsx

Layout:
1. Header with settings scope
2. Toolbar: settings search and role visibility filter
3. Main split:
   1. Left: settings section navigation tree
   2. Right: selected settings content
4. Status bar: unsaved changes and audit trace indicator

## 4.16 Settings Users
File: src/app/(dashboard)/settings/users/page.tsx

Layout:
1. Header with user management scope
2. Toolbar: search, role filter, status filter, bulk actions
3. Main: users data grid
4. Right drawer: user details and audit trail
5. Status bar: selected users and pending updates

Grid columns:
1. Name
2. Email
3. Role
4. Store Scope
5. Last Login
6. Status
7. Actions

## 4.17 Settings TV Display
File: src/app/(dashboard)/settings/tv-display/page.tsx

Layout:
1. Header with board config context
2. Toolbar: refresh presets, kiosk mode, preview actions
3. Main split:
   1. Left: configuration form
   2. Right: live board preview
4. Status bar: current interval and device health status

## 4.18 Owner Dashboard
File: src/app/(dashboard)/owner/page.tsx

Layout:
1. Header with enterprise scope and date range
2. Toolbar: region filter, store filter, compare mode, export
3. Main three-zone:
   1. Top KPI strip: revenue, profit, growth, risk
   2. Center store comparison matrix
   3. Bottom insights and exceptions feed
4. Status bar: filter context and data freshness

## 5. Reusable Component Mapping

Mandatory components for implementation:
1. AppPageShell
2. AppHeader
3. AppToolbar
4. AppStatusBar
5. EnterpriseDataGrid
6. BulkActionToolbar
7. InlineActionDrawer
8. BarcodeInputField
9. ShortcutOverlay
10. TerminalBadge
11. SyncStateBadge
12. AlertStrip
13. KpiStrip
14. AuditTrailDrawer
15. ExportMenu

## 6. Shortcut Overlay Standard
Every primary page must show relevant keyboard hints through a shortcut overlay.

Global shortcuts:
1. F2 Receive Shipment
2. F3 Search Pack
3. F4 Open Shift
4. F5 Refresh
5. Ctrl+S Save
6. Ctrl+F Search
7. Ctrl+P Print
8. Esc Cancel

## 7. Barcode Interaction Standard
1. Scanner-target inputs must be clearly labeled by scan type.
2. Scan input retains focus after successful parse.
3. Scan input retains focus after error with inline corrective guidance.
4. Scan confirmation appears within 200ms.

## 8. Accessibility and Compliance Controls
1. Every action is keyboard reachable.
2. Focus states are visible and consistent.
3. Status semantics are not color-only.
4. Critical workflow actions have explicit confirmation and audit trace.

## 9. Delivery Sequence

Phase A:
1. Shell components and status bar
2. Shared data grid and toolbar
3. Back stock, active stock, shifts migration

Phase B:
1. Receive workflow and live scan refinement
2. Display slots and pack detail migration
3. Reports tabbed workspace

Phase C:
1. Manager and owner dashboard optimization
2. Settings shell unification
3. Full shortcut and accessibility hardening

## 10. Acceptance Criteria
A page meets this wireframe spec only if:
1. It uses the global shell template.
2. It meets click-count goals for primary actions.
3. It supports keyboard-first and barcode-first operation.
4. It remains usable at 1920x1080 without routine page scrolling.
5. It exposes status, errors, and next actions clearly in-context.
