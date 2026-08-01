# LottoOps UI Implementation Backlog
Prepared for MARIONOVA PARTNERS LIMITED
Product: LottoOps
Companion documents:
- [docs/LOTTOOPS_ENTERPRISE_UX_BLUEPRINT.md](docs/LOTTOOPS_ENTERPRISE_UX_BLUEPRINT.md)
- [docs/LOTTOOPS_WIREFRAME_LAYOUT_SPECS.md](docs/LOTTOOPS_WIREFRAME_LAYOUT_SPECS.md)

## 1. Delivery Model
Cadence:
1. Two-week sprints
2. Weekly design-engineering checkpoint
3. Daily validation on keyboard-first and scanner-first criteria

Story point scale:
1. 1 point: minor UI adjustment
2. 2 points: small component enhancement
3. 3 points: medium page feature
4. 5 points: complex page refactor
5. 8 points: cross-page architectural change

## 2. Program Epics
1. E1: Enterprise Shell Foundation
2. E2: Shared Data Grid and Action Patterns
3. E3: Inventory Workflow Modernization
4. E4: Shift and Live Scan Acceleration
5. E5: Reports and Analytics Workspace
6. E6: Settings and Governance UX
7. E7: Role-Based Dashboard Redesign
8. E8: Accessibility, Keyboard, and Barcode Hardening
9. E9: QA, Telemetry, and Production Readiness

## 3. Sprint Plan Overview
1. Sprint 1: E1 and E2 foundation
2. Sprint 2: E3 back stock and active stock migration
3. Sprint 3: E3 receive and display slots migration
4. Sprint 4: E4 shifts and live scan migration
5. Sprint 5: E5 reports and sales workspace
6. Sprint 6: E6 and E7 managerial and executive experiences
7. Sprint 7: E8 and E9 hardening and launch gates

## 4. Epic Backlog and User Stories

## E1 Enterprise Shell Foundation
Goal: Standardize all primary pages with Header, Toolbar, Main Work Area, and Status Bar.

Story E1-S1 (5 points)
Title: Build reusable AppToolbar and AppStatusBar primitives
Owner: Frontend engineer
Dependencies: None
Acceptance criteria:
1. Shared toolbar and status bar components exist and are reusable.
2. Components support left, center, right slot content.
3. Components render correctly in dashboard pages with no layout shift.
4. Visual style matches enterprise standards from design blueprint.

Story E1-S2 (3 points)
Title: Build page shell wrapper for fixed-height enterprise layout
Owner: Frontend engineer
Dependencies: E1-S1
Acceptance criteria:
1. Page shell enforces fixed header, toolbar, and status bar heights.
2. Main work area uses controlled scrolling region.
3. Layout holds at 1920x1080 without global page scrolling for normal use.
4. Shell supports role context badges and action slots.

Story E1-S3 (2 points)
Title: Add shell usage guidance and examples in docs
Owner: Tech lead
Dependencies: E1-S1, E1-S2
Acceptance criteria:
1. Component usage examples are documented for page authors.
2. Required layout conventions are explicit.
3. Anti-pattern examples are included for quick review.

## E2 Shared Data Grid and Action Patterns
Goal: Replace inconsistent tables with one enterprise-grade grid interaction model.

Story E2-S1 (8 points)
Title: Create EnterpriseDataGrid v1
Owner: Frontend engineer
Dependencies: E1-S1
Acceptance criteria:
1. Grid supports sticky headers, sorting, filtering, and pagination.
2. Grid supports keyboard row and cell navigation.
3. Grid supports column visibility and column resizing.
4. Grid supports row selection and bulk actions.

Story E2-S2 (5 points)
Title: Build BulkActionToolbar and inline row action cluster
Owner: Frontend engineer
Dependencies: E2-S1
Acceptance criteria:
1. Bulk action bar appears when rows are selected.
2. Row action cluster supports primary and overflow actions.
3. Destructive actions require explicit confirmation.
4. Action latency and completion states are visible.

Story E2-S3 (3 points)
Title: Build inline action drawer to replace high-frequency modals
Owner: Frontend engineer
Dependencies: E2-S2
Acceptance criteria:
1. Inline drawer can host activate, remove, and assign workflows.
2. Keyboard focus is trapped and restored correctly.
3. Esc closes drawer and returns focus to prior row.
4. Success updates table state without full page reload.

## E3 Inventory Workflow Modernization
Goal: Reduce clicks and improve throughput in inventory pages.

Story E3-S1 (5 points)
Title: Migrate Back Stock page to enterprise shell and compact grid
Owner: Frontend engineer
Dependencies: E1-S2, E2-S1
Acceptance criteria:
1. Page uses shell layout and status bar.
2. Search and filters are in toolbar.
3. Grid is compact and supports keyboard navigation.
4. Status bar shows total back stock, available slots, and filtered count.

Story E3-S2 (5 points)
Title: Migrate Active Stock page to same interaction pattern
Owner: Frontend engineer
Dependencies: E3-S1
Acceptance criteria:
1. Active Stock page uses same shell and grid interaction model.
2. Inline remove and detail actions are available per row.
3. Low-ticket alerts appear in status bar.
4. No normal-operation vertical scroll beyond grid viewport.

Story E3-S3 (8 points)
Title: Redesign Receive Shipment into full-page step workspace
Owner: Frontend engineer plus product designer
Dependencies: E1-S2
Acceptance criteria:
1. Receive workflow has fixed summary rail and step workspace.
2. Draft resume is available for interrupted sessions.
3. Scanned pack table is high density and supports inline correction.
4. Step validation states are visible and actionable.

Story E3-S4 (5 points)
Title: Redesign Display Slots into two-pane assignment workspace
Owner: Frontend engineer
Dependencies: E2-S1, E2-S3
Acceptance criteria:
1. Slot list is dense and keyboard navigable.
2. Slot detail pane supports assign and clear actions inline.
3. Bulk assign and bulk clear actions are present.
4. Status bar shows occupied, empty, and low-ticket counts.

## E4 Shift and Live Scan Acceleration
Goal: Optimize high-frequency shift reconciliation and scanning operations.

Story E4-S1 (8 points)
Title: Redesign Shifts workspace with metrics rail and reconciliation grid
Owner: Frontend engineer
Dependencies: E1-S2, E2-S1
Acceptance criteria:
1. Left metrics rail remains visible during editing.
2. Reconciliation grid supports fast ticket entry with keyboard.
3. Save and close actions are visible in toolbar and status bar.
4. Total sales and ticket deltas update in near real-time.

Story E4-S2 (8 points)
Title: Build scanner-first Live Scan workspace with focus orchestration
Owner: Frontend engineer
Dependencies: E1-S2
Acceptance criteria:
1. Barcode input auto-focuses on load.
2. Focus auto-restores within 200ms after success or error.
3. Inline success and error states are visible.
4. Operator can undo last scan with keyboard shortcut.

Story E4-S3 (3 points)
Title: Add terminal context badge and shift state strip on scan pages
Owner: Frontend engineer
Dependencies: E4-S2
Acceptance criteria:
1. Terminal and shift status are always visible in header.
2. Context reflects active terminal and user role.
3. Shift closed state disables scan actions with clear messaging.

## E5 Reports and Analytics Workspace
Goal: Consolidate reports into one structured enterprise workspace.

Story E5-S1 (5 points)
Title: Create tabbed report workspace with global filter toolbar
Owner: Frontend engineer
Dependencies: E1-S2
Acceptance criteria:
1. Financial, inventory, activity, and custom tabs are available.
2. Date range and scope filters persist across tabs.
3. Active filters are shown in status bar.
4. Report panes avoid stacked long-scroll layout.

Story E5-S2 (3 points)
Title: Add export menu and job state feedback for report outputs
Owner: Frontend engineer
Dependencies: E5-S1
Acceptance criteria:
1. Export supports CSV, Excel, and PDF.
2. Export progress and completion are visible.
3. Failed exports provide retry action.
4. Exported scope is shown in confirmation message.

Story E5-S3 (3 points)
Title: Add sales anomaly strip and adjustment panel in Sales page
Owner: Frontend engineer
Dependencies: E5-S1
Acceptance criteria:
1. Sales page shows active anomaly alerts.
2. Adjustment workflow is compact and auditable.
3. Goal versus actual indicator is visible.
4. Keyboard path supports fast correction entry.

## E6 Settings and Governance UX
Goal: Improve settings discoverability, control, and auditability.

Story E6-S1 (5 points)
Title: Build SettingsShell with left navigation and settings search
Owner: Frontend engineer
Dependencies: E1-S2
Acceptance criteria:
1. Settings root uses navigation tree and content pane.
2. Search finds setting sections and deep links to them.
3. Role restrictions are enforced in UI and data layer.
4. Unsaved changes indicator appears in status bar.

Story E6-S2 (5 points)
Title: Upgrade Users management for bulk role operations and audit drawer
Owner: Frontend engineer
Dependencies: E2-S1, E6-S1
Acceptance criteria:
1. Multi-select supports bulk role and status changes.
2. Last login and activity indicators are visible.
3. User audit drawer shows critical account changes.
4. Destructive actions require confirmation.

Story E6-S3 (3 points)
Title: Improve TV display settings with interval presets and diagnostics
Owner: Frontend engineer
Dependencies: E6-S1
Acceptance criteria:
1. Interval presets include recommended options.
2. Kiosk controls are explicit and reversible.
3. Health diagnostics show refresh status and errors.
4. Preview remains synchronized with active settings.

## E7 Role-Based Dashboard Redesign
Goal: Match dashboard content to role needs and decisions.

Story E7-S1 (5 points)
Title: Employee control panel dashboard redesign
Owner: Frontend engineer plus product designer
Dependencies: E1-S2
Acceptance criteria:
1. Employee dashboard only shows operational actions and immediate context.
2. No executive analytics are visible in employee role.
3. Action cards are compact and keyboard accessible.
4. Urgent tasks and notifications are visible on first view.

Story E7-S2 (5 points)
Title: Manager operations dashboard redesign
Owner: Frontend engineer plus product designer
Dependencies: E7-S1
Acceptance criteria:
1. Manager dashboard includes shift, revenue, inventory, and exceptions.
2. KPIs are concise and actionable.
3. Alerts and exception queue is visible without scrolling.
4. Drill-down actions open relevant workspace directly.

Story E7-S3 (8 points)
Title: Owner and executive dashboard comparative matrix
Owner: Frontend engineer plus product designer
Dependencies: E7-S2
Acceptance criteria:
1. Multi-store comparison matrix supports sorting and filtering.
2. Revenue, profit, and growth trends are visible.
3. Insight feed highlights anomalies and opportunities.
4. Drill-down to store and region is available in one click.

## E8 Accessibility, Keyboard, and Barcode Hardening
Goal: Reach enterprise-grade usability and compliance baseline.

Story E8-S1 (5 points)
Title: Implement global shortcut map and page-level shortcut hints
Owner: Frontend engineer
Dependencies: E1-S2
Acceptance criteria:
1. Required shortcuts are active across applicable pages.
2. Shortcut hint overlay is available.
3. Conflicts with browser and OS shortcuts are resolved.
4. Shortcut usage analytics are captured.

Story E8-S2 (5 points)
Title: Accessibility pass for focus, ARIA semantics, and color-safe status
Owner: Frontend engineer plus QA
Dependencies: E2-S1
Acceptance criteria:
1. Keyboard-only user can complete top five workflows.
2. Focus states are visible and consistent.
3. Screen reader labels are present on critical controls.
4. Status semantics are not color-only.

Story E8-S3 (3 points)
Title: Barcode interaction reliability hardening
Owner: Frontend engineer plus QA
Dependencies: E4-S2
Acceptance criteria:
1. Scan field focus restoration success is above 99 percent.
2. Average scan feedback latency is below 200ms.
3. Error states preserve scan cadence.
4. No blocking browser alerts are used in scan loops.

## E9 QA, Telemetry, and Production Readiness
Goal: Ensure launch confidence and measurable UX performance.

Story E9-S1 (5 points)
Title: Build UX telemetry events for workflow timing and error rates
Owner: Frontend engineer plus platform engineer
Dependencies: E3-S1, E4-S2
Acceptance criteria:
1. Workflow timing events are emitted for core tasks.
2. Error and recovery events are tracked.
3. Dashboard for click count and completion time is available.
4. Telemetry includes role and terminal context.

Story E9-S2 (5 points)
Title: Add end-to-end regression suite for top workflows
Owner: QA engineer
Dependencies: E3-S2, E4-S2
Acceptance criteria:
1. Receive shipment workflow has end-to-end coverage.
2. Activate pack workflow has end-to-end coverage.
3. Open and close shift workflow has end-to-end coverage.
4. Live scan workflow has end-to-end coverage.

Story E9-S3 (3 points)
Title: Launch readiness checklist and sign-off gates
Owner: Product manager
Dependencies: all prior epics
Acceptance criteria:
1. Accessibility gate is passed.
2. Keyboard and scanner gate is passed.
3. Performance targets are met for key workflows.
4. Stakeholder sign-off is complete.

## 5. Definition of Ready
A story is ready when:
1. UX flow and wireframe references are attached.
2. Data dependencies and API impacts are identified.
3. Acceptance criteria are testable.
4. Role permissions and edge cases are listed.

## 6. Definition of Done
A story is done when:
1. Acceptance criteria pass.
2. Keyboard-first path is verified.
3. Barcode-first behavior is verified where applicable.
4. No visual regression against enterprise shell standards.
5. Telemetry and audit behavior are validated.

## 7. Initial Sprint Candidate
Recommended Sprint 1 candidate stories:
1. E1-S1
2. E1-S2
3. E2-S1
4. E3-S1
5. E8-S1

Expected Sprint 1 outcome:
1. Back Stock page becomes the reference implementation for all subsequent migrations.
2. Shared shell and grid patterns are production-ready.
3. Keyboard workflow instrumentation is available for baseline measurement.
