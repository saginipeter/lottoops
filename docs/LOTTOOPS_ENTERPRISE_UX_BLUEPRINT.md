# LottoOps Enterprise UX Blueprint
Prepared by: Principal Enterprise UX Architect and Product Designer  
Organization: MARIONOVA PARTNERS LIMITED  
Product: LottoOps

## 1. Purpose
This document defines the mandatory UI and UX standards for LottoOps as an enterprise lottery operations platform. It is intended for product, design, and engineering teams building Cloud SaaS, Windows Desktop, and hybrid offline workflows.

This standard applies to all current and future LottoOps interfaces.

## 2. Product Context
LottoOps is an enterprise operations product used by:
1. Store employees
2. Supervisors and shift leads
3. Store and regional managers
4. Auditors
5. Executives
6. Lottery operators and enterprise partners

Primary usage profile:
1. Repetitive operational tasks
2. Extended usage sessions (8 to 12 hours/day)
3. Keyboard and scanner intensive workflows
4. High accountability and low error tolerance

## 3. Non-Negotiable Design Principles
1. Optimize for speed first.
2. Reduce user mistakes.
3. Minimize clicks in every workflow.
4. Design keyboard-first interactions.
5. Design barcode-first interactions.
6. Maintain professional enterprise visual language.
7. No emojis in product UI.
8. No unnecessary animations.
9. No decorative graphics.
10. Functionality always takes priority over aesthetics.

## 4. Layout and Screen Architecture Standards
Target primary operating resolution: 1920x1080.

Normal operation should not require vertical scrolling.

All primary workflow pages must use this structure:
1. Header
2. Toolbar
3. Main Working Area
4. Status Bar

### 4.1 Structural Dimensions
1. Header: 52px fixed height
2. Toolbar: 48px fixed height
3. Status Bar: 42px fixed height
4. Main Working Area: remaining viewport height, local scroll only when required

### 4.2 Screen Behavior
1. Avoid long stacked sections.
2. Avoid oversized cards.
3. Keep critical actions visible without opening additional menus.
4. Keep frequently used actions in toolbar or row-inline controls.

## 5. Current Application Assessment

### 5.1 Strengths
1. Strong operational workflow coverage: receive, activate, shift operations, reporting.
2. Clear route-based module organization and role-aware navigation.
3. Existing reusable UI foundations: panel, button, dialog, status badge, stat card.
4. Real business contexts are represented in current pages and components.

### 5.2 Usability Gaps
1. Modal overuse in frequent workflows increases click count and context switching.
2. Low-density table layouts reduce information visibility per screen.
3. Inconsistent page structure across modules.
4. Limited keyboard-first interaction patterns.
5. Barcode focus is not consistently auto-restored for continuous scanning.
6. Missing persistent status bar and operational context indicators.
7. Scattered actions and hidden common operations in secondary UI locations.

### 5.3 Enterprise Readiness Gaps
1. No standardized data grid pattern across high-volume pages.
2. No global shortcut framework and discoverability.
3. Inconsistent audit visibility in settings and critical action flows.
4. Weak terminal/device context visibility in operator screens.

## 6. Role-Based Experience Architecture

### 6.1 Employee Dashboard Standard
Employee dashboard must be a control panel, not an analytics page.

Show:
1. Receive Shipment
2. Activate Pack
3. Open Shift
4. Close Shift
5. Inventory Lookup
6. Current Shift
7. Today's Sales
8. Notifications

Do not show:
1. Large analytics visualizations
2. Complex trend graphs
3. Executive KPI content

### 6.2 Manager Dashboard Standard
Manager dashboard should prioritize operations with lightweight analytics.

Show:
1. Sales summary
2. Revenue
3. Inventory status
4. Shift status
5. Employees working
6. Alerts and exception reports
7. Operational KPI snapshots

### 6.3 Executive Dashboard Standard
Executive dashboard should be strategic and comparative.

Show:
1. Company performance
2. Regional performance
3. Store comparison
4. Revenue and profit
5. Forecasts
6. AI insights and growth trends

## 7. Workflow Performance Targets
1. Receive Shipment: 3 to 5 clicks
2. Activate Pack: 2 to 3 clicks
3. Inventory Search: less than 5 seconds
4. Open Shift: less than 30 seconds
5. Close Shift: less than 60 seconds

All workflows must expose common actions directly in context.

## 8. Keyboard-First and Barcode-First Standards

### 8.1 Keyboard Standards
Required support:
1. Tab navigation with logical order
2. Enter to confirm
3. Esc to cancel
4. Arrow key navigation in tables and lists
5. Function key and control shortcuts

Baseline shortcut map:
1. F2: Receive Shipment
2. F3: Search Pack
3. F4: Open Shift
4. F5: Refresh
5. Ctrl+S: Save
6. Ctrl+F: Search
7. Ctrl+P: Print

### 8.2 Barcode Standards
1. Scanner fields must auto-focus on page load.
2. Scanner focus must auto-restore after success or error.
3. Barcode feedback must be inline and immediate.
4. Continuous scanning must not require repeated mouse clicks.
5. Distinguish PACK scan versus TICKET scan labels clearly.

## 9. Data Grid and Form Standards

### 9.1 Data Grid Standards
All operational tables must support:
1. Sticky headers
2. Sorting
3. Filtering
4. Column resizing
5. Column hiding
6. Pagination or virtualization
7. Bulk actions
8. Inline editing where appropriate
9. Keyboard navigation
10. High information density

Density baseline:
1. Compact row spacing
2. 20 or more visible rows at 1920x1080 on primary inventory screens

### 9.2 Form Standards
1. Compact layout
2. Maximum two-column forms
3. Labels above fields
4. Group related fields
5. Avoid long forms
6. Avoid unnecessary modal dialogs

## 10. Visual System Standards
1. Professional and minimal style
2. High-contrast UI
3. No gradients
4. No bright decorative colors
5. Color reserved for status semantics only:
   1. Success
   2. Warning
   3. Error
   4. Information
6. Consistent typography scale
7. Consistent spacing scale

## 11. Accessibility Standards
1. Full keyboard operability
2. Screen reader compatibility
3. Clear visible focus states
4. Color-blind friendly status indicators
5. High contrast mode support
6. Adequate click and touch targets

## 12. Desktop Runtime Standards (Windows)
1. Native-feeling interaction model
2. Fast startup and stable long sessions
3. Peripheral-optimized workflows:
   1. Barcode scanner
   2. Receipt printer
   3. Cash drawer
   4. Customer display
   5. TV display
4. Action feedback for connected peripherals
5. Offline and reconnection states must be visible

## 13. Page-by-Page UX Evaluation and Redesign

### 13.1 Login
File: src/app/login/page.tsx

Current pattern:
1. Split-pane branded layout with centered login form

Issues:
1. No rapid enterprise login aids for high-throughput environments
2. Session expiry context not explicit before redirect
3. Reduced operational clarity for shared terminal login behavior

Redesign:
1. Keep compact credential form
2. Add explicit session-state and terminal-context banner
3. Add optional rapid sign-in integrations roadmap hooks (badge scanner/SSO)

Reusable components:
1. AuthForm
2. SessionAlertBanner
3. TerminalContextHint

### 13.2 Setup
File: src/app/setup/page.tsx

Current pattern:
1. Linear setup flow with form states

Issues:
1. Limited inline validation guidance
2. High risk of data loss on accidental navigation
3. Insufficient enterprise defaults guidance

Redesign:
1. Guided compact step flow with persistent draft state
2. Inline validation and explicit required-field indicators
3. Setup completion summary with printable configuration receipt

Reusable components:
1. SetupStepper
2. FormSection
3. ValidationSummary

### 13.3 TV Display (Public Board)
File: src/app/tv-display/page.tsx

Current pattern:
1. Auto-refresh board

Issues:
1. Refresh failure states are not operationally explicit
2. No manual refresh control in support scenarios
3. Limited alert semantics for low-stock/exception packs

Redesign:
1. Add board heartbeat and last-updated timestamp
2. Add manual refresh action
3. Add strict status coding for inventory urgency

Reusable components:
1. TvBoardGrid
2. LiveHeartbeatIndicator
3. RefreshControl

### 13.4 Dashboard Root
File: src/app/(dashboard)/page.tsx

Current pattern:
1. Card-based action launcher

Issues:
1. Oversized action cards reduce information density
2. No due-now task strip
3. Limited role-specific prioritization

Redesign:
1. Convert to compact control panel layout
2. Add action queue strip (what to do now)
3. Add compact status KPIs aligned to user role

Reusable components:
1. ActionPanelCard
2. PriorityTaskStrip
3. CompactKpiRow

### 13.5 Shifts
File: src/app/(dashboard)/shifts/page.tsx

Current pattern:
1. Shift dashboard with reconciliation views

Issues:
1. Wide table layout with potential scan-to-close friction
2. Critical actions may require excessive movement
3. Limited persistent terminal and shift context visibility

Redesign:
1. Three-zone layout: context rail, reconciliation grid, action status bar
2. Fixed quick actions for save and close
3. Keyboard-optimized inline ticket entry path

Reusable components:
1. ShiftReconciliationGrid
2. ShiftContextRail
3. ShiftStatusBar

### 13.6 Inventory Back Stock
File: src/app/(dashboard)/inventory/page.tsx

Current pattern:
1. Search/filter plus back stock table and row actions

Issues:
1. Modal-heavy action paths for frequent operations
2. Missing bulk operations
3. Search and action controls not fully consolidated

Redesign:
1. Toolbar with search, filters, and bulk actions
2. Inline row action panel instead of modal flow
3. Compact data grid with keyboard and barcode interoperability

Reusable components:
1. EnterpriseDataGrid
2. InventoryToolbar
3. InlineActionPanel

### 13.7 Inventory Active
File: src/app/(dashboard)/inventory/active/page.tsx

Current pattern:
1. Active stock table

Issues:
1. Dense operational actions not exposed inline enough
2. Potential horizontal scanning burden from wide columns
3. Limited column personalization

Redesign:
1. Reduce core columns to operational essentials
2. Add row-inline action cluster
3. Add column hide/show and saved view presets

Reusable components:
1. EnterpriseDataGrid
2. ColumnPresetMenu
3. RowActionCluster

### 13.8 Inventory Live Scan
File: src/app/(dashboard)/inventory/live-scan/page.tsx

Current pattern:
1. Scan-centric dashboard

Issues:
1. Scanner queue and success state feedback can be stronger
2. Terminal identity context can be more prominent
3. Inline error handling can better preserve scan cadence

Redesign:
1. Large persistent scan input lane
2. Immediate inline scan result card with auto-focus restore
3. Right-side compact activity feed and undo command

Reusable components:
1. BarcodeInputLane
2. ScanFeedbackCard
3. LiveActivityFeed

### 13.9 Inventory Receive
File: src/app/(dashboard)/inventory/receive/page.tsx

Current pattern:
1. Step-based receive workflow

Issues:
1. Multi-step flow may feel modal and disrupt operational continuity
2. Draft recovery and resume workflow can be strengthened
3. Review stage could be denser for high-volume shipments

Redesign:
1. Full-page guided workflow with persistent step rail
2. Draft resume and checkpointing
3. High-density review table with inline validation and corrections

Reusable components:
1. ReceiveWorkflowLayout
2. ShipmentStepRail
3. ScannedPacksGrid

### 13.10 Inventory Returned
File: src/app/(dashboard)/inventory/returned/page.tsx

Current pattern:
1. Returned list view

Issues:
1. Limited filtering and grouping for audit use
2. Potentially weak traceability at glance
3. Missing export-first controls for compliance

Redesign:
1. Add reason/date/user filters in toolbar
2. Group by removal reason with quick fold sections
3. Add print/export audit actions in top bar

Reusable components:
1. ReturnedFilterToolbar
2. ReasonGroupList
3. AuditExportActions

### 13.11 Inventory Pack Detail
File: src/app/(dashboard)/inventory/packs/[id]/page.tsx

Current pattern:
1. Detailed single-pack lifecycle view

Issues:
1. Timeline density and pagination can be improved
2. Barcode quick actions are not fully optimized
3. Related pack context is limited

Redesign:
1. Compact split layout with pinned pack summary
2. Paginated timeline with filter chips
3. Add quick links to similar packs and exception history

Reusable components:
1. PackSummaryPane
2. TimelineFilterBar
3. RelatedPackList

### 13.12 Display Slots
File: src/app/(dashboard)/display-slots/page.tsx

Current pattern:
1. Grid/card-based slot management

Issues:
1. Card layout reduces density and rapid scanning efficiency
2. Bulk operations are limited
3. Slot reassignment workflows are click-heavy

Redesign:
1. Two-pane dense slot list plus detail/action pane
2. Bulk assign and bulk clear actions
3. Keyboard and drag-assisted reassignment support

Reusable components:
1. SlotListGrid
2. SlotDetailPane
3. SlotBulkActionToolbar

### 13.13 Games
File: src/app/(dashboard)/games/page.tsx

Current pattern:
1. Games manager table and sync utilities

Issues:
1. Sync operations can be more transparent
2. Batch edits/import previews can be improved
3. Operational stock context can be tighter

Redesign:
1. Add sync timeline and status badges
2. Batch review before commit
3. Add active-pack counts and inventory health per game

Reusable components:
1. GameSyncStatusPanel
2. BatchImportReviewGrid
3. GameHealthBadge

### 13.14 Reports
File: src/app/(dashboard)/reports/page.tsx

Current pattern:
1. Stacked report modules

Issues:
1. Stacked layout increases scrolling and context switching
2. Filter controls are fragmented
3. Export workflow can be centralized

Redesign:
1. Tabbed report workspace with shared global filters
2. Unified export and scheduling controls
3. Keep report viewport fixed with local content scrolling

Reusable components:
1. ReportWorkspaceTabs
2. ReportGlobalToolbar
3. ExportSchedulerMenu

### 13.15 Sales
File: src/app/(dashboard)/sales/page.tsx

Current pattern:
1. Sales dashboard with current and recent context

Issues:
1. Missing correction and exception entry ergonomics
2. Limited pacing and target visualization
3. Alerting for anomalies could be stronger

Redesign:
1. Add compact adjustments panel
2. Add goal-versus-actual indicator
3. Add anomaly flag strip for supervisor intervention

Reusable components:
1. SalesSummaryGrid
2. AdjustmentPanel
3. SalesAnomalyStrip

### 13.16 Settings Root
File: src/app/(dashboard)/settings/page.tsx

Current pattern:
1. Card navigation to settings sections

Issues:
1. Card hub is slower than structured settings navigation
2. Searchability of settings is limited
3. Change audit visibility is limited

Redesign:
1. Left-nav settings shell with searchable settings index
2. Context panel with audit history for selected setting
3. Role-aware section visibility and read-only states

Reusable components:
1. SettingsShell
2. SettingsSearch
3. SettingsAuditPanel

### 13.17 Settings Users
File: src/app/(dashboard)/settings/users/page.tsx

Current pattern:
1. Users manager table

Issues:
1. Batch role and status actions can be expanded
2. Login activity telemetry can be more visible
3. Password reset feedback can be improved

Redesign:
1. Add multi-select user management actions
2. Add last activity and login reliability indicators
3. Add confirmation and audit trace for critical account changes

Reusable components:
1. UsersGrid
2. BulkRoleToolbar
3. UserAuditTrailDrawer

### 13.18 Settings TV Display
File: src/app/(dashboard)/settings/tv-display/page.tsx

Current pattern:
1. TV board settings and preview

Issues:
1. Refresh interval ergonomics can be improved
2. Kiosk/fullscreen controls can be more explicit
3. Operator guidance for deployment can be stronger

Redesign:
1. Add preset interval controls with recommended defaults
2. Add explicit fullscreen controls and fail-safe exits
3. Add quick diagnostics panel for display station health

Reusable components:
1. IntervalPresetSelector
2. KioskControlPanel
3. DisplayDiagnosticsCard

### 13.19 Owner Dashboard
File: src/app/(dashboard)/owner/page.tsx

Current pattern:
1. Owner-only aggregate dashboard

Issues:
1. Cross-store comparison is likely less interactive than needed
2. Store discovery and filtering can be improved
3. Drill-down pathways should be faster

Redesign:
1. Add comparative store matrix with sort/filter
2. Add region and time-range quick presets
3. Enable click-through drill-down to operational exceptions

Reusable components:
1. StoreComparisonMatrix
2. ExecutiveFilterBar
3. InsightDrilldownPanel

## 14. Required Reusable Component Library
Create and standardize these reusable components for all future UI work:
1. AppPageShell
2. AppHeader
3. AppToolbar
4. AppStatusBar
5. EnterpriseDataGrid
6. InlineActionPanel
7. BarcodeInputLane
8. FilterChipsRow
9. BulkActionToolbar
10. ContextRail
11. KpiStrip
12. AlertStrip
13. ShortcutHintOverlay
14. TerminalContextBadge
15. AuditTrailDrawer
16. ExportActionMenu
17. FormSection
18. ConfirmationBar
19. EmptyStateStandard
20. ErrorStateStandard

## 15. Interaction Standards

### 15.1 Modal Policy
1. Avoid modals for high-frequency actions.
2. Use inline expansion, side panels, or context rails.
3. Reserve modal dialogs for destructive confirmations only.

### 15.2 Action Placement Policy
1. Frequent actions: visible in toolbar or row-inline controls.
2. Rare actions: in overflow menu.
3. Critical actions: duplicated in status bar when time-sensitive.

### 15.3 Error Handling Policy
1. Never block scanner cadence with browser alerts.
2. Show inline errors near input or row.
3. Preserve user context and focus after errors.
4. Provide one-click retry when safe.

## 16. Information Density Standards
1. Prefer compact rows and concise labels.
2. Minimize decorative spacing.
3. Keep high-value columns visible.
4. Use progressive disclosure for secondary metadata.

## 17. Accessibility and Compliance Controls
1. Every interactive element must be keyboard reachable.
2. Every status must include text, not color alone.
3. Focus state must be explicit and consistent.
4. ARIA labels required for scan and action controls.
5. Data and action auditability must be visible where regulated actions occur.

## 18. Future UI Governance
This design system is now the baseline policy for LottoOps.

All new pages and redesigns must:
1. Use the standard page shell.
2. Use shared enterprise components.
3. Meet workflow click and timing targets.
4. Pass keyboard and scanner usability checks.
5. Pass accessibility checks.

## 19. Implementation Priority

### Phase 1 (Core UX Foundation)
1. Implement AppPageShell, AppToolbar, AppStatusBar.
2. Implement EnterpriseDataGrid and BulkActionToolbar.
3. Refactor inventory back stock, active stock, and shifts pages to the new shell.

### Phase 2 (Workflow Acceleration)
1. Refactor receive workflow into full-page guided layout.
2. Replace modal-heavy pack actions with InlineActionPanel patterns.
3. Add barcode focus orchestration and scan feedback standards.

### Phase 3 (Enterprise Role Experiences)
1. Redesign manager and owner dashboards for comparative operations views.
2. Consolidate settings into searchable settings shell with audit panel.
3. Upgrade reports into tabbed workspace with global filters and export scheduler.

## 20. Definition of Done for UI Work
UI tasks are complete only if:
1. Page uses standard shell and reusable components.
2. Workflow click targets are met.
3. Keyboard paths are fully verified.
4. Barcode path is continuous and focus-safe.
5. Accessibility acceptance checks pass.
6. No decorative or non-functional UI additions are introduced.
