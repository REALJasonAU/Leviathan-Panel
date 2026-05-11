# Leviathan Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Leviathan Command Deck redesign across admin and user panel flows with reusable Svelte components and balanced spacing.

**Architecture:** Keep the existing runtime/data flow in `App.svelte` but introduce a reusable layout and component system first, then refit all admin/user views onto those primitives. Use one shared tokenized theme and avoid backend/API contract changes.

**Tech Stack:** Svelte + TypeScript + existing API client/store, CSS token system.

---

### Task 1: Introduce design tokens and global shell primitives

**Files:**

- Modify: `apps/panel/src/app.css`
- Create: `apps/panel/src/lib/components/AppShell.svelte`
- Create: `apps/panel/src/lib/components/TopHeader.svelte`
- Create: `apps/panel/src/lib/components/SidebarNav.svelte`

- [ ] **Step 1: Write failing structure check**

Add temporary references in `App.svelte` imports for `AppShell`, `TopHeader`, and `SidebarNav` and run typecheck expecting module-not-found failure.

- [ ] **Step 2: Run failing check**

Run: `pnpm --filter @voltan/panel typecheck`  
Expected: FAIL with missing component import errors.

- [ ] **Step 3: Implement minimal components and tokenized styles**

Create:

- `AppShell.svelte`: sidebar slot + header slot + content slot wrappers.
- `TopHeader.svelte`: breadcrumb/title/search/actions container.
- `SidebarNav.svelte`: grouped navigation with active state and compact icon markers.

Update `app.css`:

- define palette, spacing, typography, state, badge, button, table, console, and card tokens
- include responsive shell rules for desktop/tablet/mobile.

- [ ] **Step 4: Verify imports compile**

Run: `pnpm --filter @voltan/panel typecheck`  
Expected: PASS for newly introduced files.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/src/app.css apps/panel/src/lib/components/AppShell.svelte apps/panel/src/lib/components/TopHeader.svelte apps/panel/src/lib/components/SidebarNav.svelte
git commit -m "feat(panel): add command-deck shell and theme tokens"
```

### Task 2: Build reusable UI primitives used across admin and user pages

**Files:**

- Modify: `apps/panel/src/lib/components/Card.svelte`
- Modify: `apps/panel/src/lib/components/StatCard.svelte`
- Modify: `apps/panel/src/lib/components/EmptyState.svelte`
- Create: `apps/panel/src/lib/components/StatusBadge.svelte`
- Create: `apps/panel/src/lib/components/ActionButton.svelte`
- Create: `apps/panel/src/lib/components/PageHeader.svelte`
- Create: `apps/panel/src/lib/components/TabNav.svelte`

- [ ] **Step 1: Write failing usage in `App.svelte`**

Reference `StatusBadge`, `ActionButton`, `PageHeader`, and `TabNav` from `App.svelte` in one section and run typecheck expecting missing modules.

- [ ] **Step 2: Run failing check**

Run: `pnpm --filter @voltan/panel typecheck`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement primitives**

Implement:

- semantic button variants (`primary`, `secondary`, `ghost`, `danger`)
- normalized status badges for online/offline/maintenance/updating/etc
- shared page title + actions wrapper
- generic tab list component with active value callback
- improved card/stat/empty-state wrappers aligned to new design language.

- [ ] **Step 4: Run verification**

Run: `pnpm --filter @voltan/panel typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/src/lib/components
git commit -m "feat(panel): add reusable command-deck UI primitives"
```

### Task 3: Refactor `App.svelte` to use shell and grouped sidebar architecture

**Files:**

- Modify: `apps/panel/src/App.svelte`

- [ ] **Step 1: Introduce grouped nav model**

Replace flat nav rendering with grouped sections:

- Main, Access, Infrastructure, System
- include all requested nav entries
- add environment pill near sidebar footer.

- [ ] **Step 2: Replace top layout with `AppShell` + `TopHeader` + `PageHeader`**

Use shell components around existing content and keep route/hash + data loading logic unchanged.

- [ ] **Step 3: Add global command/search and notifications/avatar affordances**

Implement header controls as UI-only actions where behavior is not wired yet.

- [ ] **Step 4: Verify functional parity**

Run panel dev and verify:

- hash navigation still works
- existing data fetches still execute
- no runtime errors opening main views.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/src/App.svelte
git commit -m "refactor(panel): apply command-deck shell to app root"
```

### Task 4: Redesign admin overview and primary admin list pages

**Files:**

- Modify: `apps/panel/src/App.svelte`

- [ ] **Step 1: Recompose overview section**

Create:

- admin KPI strip
- node health summary card
- audit/alerts summary cards
- compact chart placeholders styled with design tokens.

- [ ] **Step 2: Recompose pages for nodes/users/roles/api-keys/audit-logs/jobs**

Use:

- shared table wrappers
- page headers with contextual actions
- status badges and action buttons.

- [ ] **Step 3: Recompose cloudflare/firewall/daemon updates/plugins/billing/settings**

Add:

- masked secret styling
- dry-run/apply/delete action grouping
- warning panels for risky operations.

- [ ] **Step 4: Verify admin page rendering**

Run panel and navigate all admin views; confirm no section crashes and styles are consistent.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/src/App.svelte
git commit -m "feat(panel): redesign admin pages with balanced command-deck layout"
```

### Task 5: Redesign user server list and server detail tab architecture

**Files:**

- Modify: `apps/panel/src/App.svelte`

- [ ] **Step 1: Redesign user overview + server list**

Implement:

- summary cards
- recent activity/alerts layout
- server list table/card sections with quick actions and status strip.

- [ ] **Step 2: Redesign server detail header**

Add:

- breadcrumbs
- status + power actions
- top resource strip
- tab navigation via `TabNav`.

- [ ] **Step 3: Redesign tab content surfaces**

Rework:

- Console
- Files
- Backups
- Schedules
- Network
- Environment
- Sub-users
- Settings

using shared cards/tables/badges and balanced spacing.

- [ ] **Step 4: Verify server flow functionality**

Validate:

- console socket still connects
- file actions still call existing API methods
- backup/schedule/network/env/sub-user interactions still work.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/src/App.svelte
git commit -m "feat(panel): redesign user server management surfaces"
```

### Task 6: Add loading, empty, error, and confirmation polish

**Files:**

- Modify: `apps/panel/src/App.svelte`
- Modify: `apps/panel/src/lib/components/EmptyState.svelte`

- [ ] **Step 1: Normalize loading and empty states**

Apply skeleton/empty wrappers to overview, table views, server tabs, and admin tools pages.

- [ ] **Step 2: Normalize error and dangerous action UX**

Ensure clear error messaging blocks and explicit danger-zone/confirmation styles for destructive actions.

- [ ] **Step 3: Verify one-time secret and masked fields behavior**

Keep generated key reveal and masked credential patterns visually clear and non-leaky.

- [ ] **Step 4: Commit**

```bash
git add apps/panel/src/App.svelte apps/panel/src/lib/components/EmptyState.svelte
git commit -m "feat(panel): add consistent loading empty error and danger patterns"
```

### Task 7: Verification and docs refresh

**Files:**

- Modify: `README.md` (UI section summary only)
- Modify: `docs/phase6-notes.md` (or latest phase note file used by project)

- [ ] **Step 1: Run formatting and quality gates**

Run:

- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

- [ ] **Step 2: Fix regressions if any**

Resolve panel type/style/test issues introduced by redesign.

- [ ] **Step 3: Update docs for new UI architecture**

Document:

- command-deck shell
- component system
- user/admin redesign scope and known partials if any.

- [ ] **Step 4: Final commit**

```bash
git add README.md docs apps/panel/src
git commit -m "docs(panel): document leviathan dashboard redesign"
```

## Self-Review

### Spec coverage

- Visual system and balanced spacing: covered in Tasks 1-2.
- Admin architecture: covered in Task 4.
- User/server architecture: covered in Task 5.
- Reusable components: covered in Tasks 1-2.
- State UX (empty/loading/error/danger): covered in Task 6.
- Verification: covered in Task 7.

### Placeholder scan

- No `TODO`/`TBD` placeholders in tasks.
- Each task includes explicit files and commands.

### Type consistency

- Component names and responsibilities are consistent across all tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-11-leviathan-dashboard-redesign-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints
