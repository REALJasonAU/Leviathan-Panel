# Leviathan Dashboard Redesign Design Spec

Date: 2026-05-11
Status: Draft for user approval
Scope: UI/UX redesign for Leviathan user and admin panel (no backend feature rewrite)

## 1. Objective

Redesign the Leviathan panel into a premium, modern, operationally dense (but balanced) interface that improves usability over Pterodactyl while preserving practical workflows for server and infrastructure management.

This redesign covers:

- admin control surfaces
- user server-management surfaces
- a unified component system
- consistent dark abyss visual identity
- accessible, responsive behavior

This redesign does not require:

- backend API contract changes
- daemon runtime rewrites
- replacement of existing authorization/business logic

## 2. Product Direction

Leviathan must feel:

- powerful
- dark and technical
- security-conscious
- infrastructure-focused
- practical and fast
- professional, not playful

The approved visual direction is **A. Command Deck** with **balanced spacing everywhere** across both admin and user experiences.

## 3. Visual System

### 3.1 Color Tokens

- App background: `#05070D`
- Sidebar background: `#0B1020`
- Main surface: `#111827`
- Elevated card: `#151E2E`
- Deep console background: `#020617`
- Border: `#1E293B`
- Soft border: `#334155`
- Primary cyan: `#00D4FF`
- Primary cyan hover: `#38E8FF`
- Purple accent: `#7C3AED`
- Purple soft: `#A78BFA`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`
- Text primary: `#F8FAFC`
- Text secondary: `#94A3B8`
- Muted text: `#64748B`

### 3.2 Typography

- Font family: `Inter` or `Geist` (with system fallback).
- Headings: confident, tight tracking, clear hierarchy.
- Body: compact and readable.
- Metrics and structured values: tabular numerals.
- Console/editor areas: monospace stack.

### 3.3 Tone Rules

- No cartoon sea-monster motifs.
- No excessive neon glow.
- No generic white-label SaaS styling.
- No overly sparse enterprise layouts.
- Use subtle cyan/purple accents for interaction and focus, not decorative overload.

## 4. Layout Architecture

### 4.1 Global Shell

Single shared shell for admin and user views:

- fixed left sidebar (desktop)
- persistent top header with search/actions
- main content canvas with consistent gutters
- breadcrumbs on detail screens

### 4.2 Sidebar Information Architecture

#### Main

- Overview
- Servers
- Nodes
- Templates
- Backups
- Schedules

#### Access

- Users
- Roles
- API Keys
- Audit Logs

#### Infrastructure

- Allocations
- Network
- Cloudflare
- Firewall
- SFTP
- Daemon Updates

#### System

- Webhooks
- Plugins
- Billing
- Settings

Sidebar requirements:

- collapsible groups
- icon for each item
- active item cyan/purple accent state
- Leviathan mark + wordmark at top
- environment pill near bottom (for example, daemon online state)

### 4.3 Header

- page breadcrumbs
- command/search input
- notifications icon/button
- avatar/user menu
- contextual actions where relevant

### 4.4 Responsive Strategy

- Desktop: fixed sidebar + multi-column layouts.
- Tablet: collapsible sidebar + compressed grids.
- Mobile: overlay sidebar + stacked content + action condensation.
- Balanced spacing remains consistent across breakpoints.

## 5. Admin Experience Architecture

### 5.1 Admin Overview

- KPI cards: revenue (if enabled), servers, users, nodes, failed jobs
- platform resource strip: global CPU/RAM/disk + node online/offline
- recent audit events panel
- alerts panel
- node health summary with compact charts

### 5.2 Nodes

- searchable/sortable node table
- status, region, daemon version, resource usage, server count
- maintenance and update indicators
- quick row actions

### 5.3 Node Detail

- node health, daemon/docker status
- resource trends
- hosted server list
- allocations view
- daemon update controls
- maintenance toggle

### 5.4 Templates

- template cards/table
- docker image + startup command
- env definition editor + `.env.example` import

### 5.5 Users

- user table with role, auth posture, server count, last active
- suspend/manage actions

### 5.6 Roles

- role list + grouped permission editor
- admin permission warning surface
- save/discard workflow

### 5.7 API Keys

- prefix-only listing
- scopes, created/expiry/last-used, revoked state
- one-time reveal modal for newly generated key

### 5.8 Audit Logs

- searchable/filterable event table
- actor/target/action/time (+ source metadata when available)
- sensitive fields redacted

### 5.9 Backup Targets

- local/s3 provider cards
- masked credential presentation
- test connection action + status

### 5.10 Cloudflare

- masked token settings
- routes + DNS status
- dry-run/apply/delete controls
- synced/out-of-sync indicators

### 5.11 Firewall

- provider status (UFW/nftables)
- allow/deny rules table
- dry-run/apply controls
- risk warning panel

### 5.12 Daemon Updates

- node version matrix
- update availability
- update/rollback actions
- history + failure states

### 5.13 Queue/Jobs

- status-filtered jobs table
- retries and failure context
- detail drawer + retry action

### 5.14 Webhooks

- endpoint list + event filters
- delivery history + retry status
- test webhook action

### 5.15 Plugins

- installed plugin list
- version/capability metadata
- enable/disable with trust warning

### 5.16 Billing

- Stripe and WHMCS config blocks
- webhook/mapping status
- provision/suspend/unsuspend/terminate mapping UI

### 5.17 Settings

- grouped platform controls
- sticky save/discard affordance
- validation and warning copy

## 6. User Experience Architecture

### 6.1 User Overview

- welcome + quick actions
- server state summary metrics
- aggregate CPU/RAM/disk
- recent servers + activity + alerts

### 6.2 Server List

- table and card modes
- per-server status, allocation, usage, network
- quick actions: start/restart/stop/console
- right-edge status strip

### 6.3 Server Detail Shell

- breadcrumbs + title + status
- primary power action set
- top resource strip
- tab system:
  - console
  - files
  - backups
  - schedules
  - network
  - environment
  - sub-users
  - settings

### 6.4 Console

- large deep-console panel
- ANSI-friendly output
- command input/history
- search/filter
- autoscroll toggle
- clear/copy error actions
- supporting metric cards + compact charts

### 6.5 Files

- path breadcrumb
- upload/new actions
- drag/drop zone
- file table + row actions
- editor drawer/modal
- progress states and dangerous-action confirmation

### 6.6 Backups

- backup list with provider/status/size/date/lock
- create/restore/download/delete actions
- progress states for active operations

### 6.7 Schedules

- task list with cron metadata
- enabled toggle
- manual run
- create/edit drawer with cron validation

### 6.8 Network

- allocation table with primary marker
- domain mappings
- cloudflare sync status
- firewall summary
- sftp connection info + copy controls

### 6.9 Environment

- env variable grid
- required/optional + secret/readonly badges
- masked secret values
- `.env.example` preview/import
- validation and save/discard states

### 6.10 Sub-users

- members list
- invite form
- grouped permission matrix
- audit-friendly change flow

### 6.11 Server Settings

- startup command, image, limits
- reinstall/rebuild controls
- isolated danger zone (suspend/reinstall/delete/rebuild)

## 7. Reusable Component System

Create reusable components and avoid duplicated page-level implementations:

- App shell
- Sidebar navigation
- Top header
- Breadcrumbs
- Page header
- Cards and metric cards
- Data table
- Tab navigation
- Button and icon button variants
- Status badges
- Alerts and toasts
- Form controls and grouped field rows
- Toggle switch
- Progress bar
- Chart container + legend style
- Console panel
- File dropzone
- Skeleton states
- Empty and error states
- Confirmation modal
- One-time secret reveal modal
- Danger zone panel

## 8. Interaction, State, and Safety UX

- All destructive actions require clear confirmation.
- Secrets are always masked in persistent views.
- One-time secrets include explicit irreversible-warning copy.
- Loading states use skeletons, not spinner-only placeholders.
- Empty states include next-step instructions.
- Error states provide actionable recovery hints.
- Permission-aware UI hides or disables actions users cannot perform.

## 9. Accessibility and Usability Requirements

- Maintain strong contrast in all dark-mode surfaces.
- Ensure keyboard-focus visibility for all interactive elements.
- Preserve hit area size for icon buttons and compact controls.
- Keep tab order logical across cards, tables, and modals.
- Keep motion subtle and functional (no decorative animation overload).

## 10. Implementation Plan (UI-only, incremental)

1. Extract and centralize design tokens.
2. Introduce shell primitives (sidebar, header, page header).
3. Build shared interaction primitives (buttons, badges, tabs, table, form).
4. Apply to admin pages first.
5. Apply to server/user pages second.
6. Add skeleton/empty/error/confirmation patterns consistently.
7. Final responsive/accessibility polish.

Implementation should preserve existing API calls and state flows wherever possible to reduce risk.

## 11. Out of Scope

- Backend schema changes
- API auth/permission model redesign
- Daemon protocol changes
- Feature additions unrelated to UI/UX improvements

## 12. Success Criteria

- Unified Leviathan visual identity across all pages.
- Balanced spacing is consistent in admin and user surfaces.
- Faster operational scanning for high-signal states and actions.
- Clearer dangerous-action separation and secret handling UX.
- No regressions in existing runtime functionality.
