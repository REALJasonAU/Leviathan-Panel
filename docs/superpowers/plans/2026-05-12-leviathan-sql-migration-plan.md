# Leviathan SQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase and Firestore with local MariaDB-backed panel and daemon storage, add built-in password auth with secure cookie sessions, and upgrade installers to fully provision MariaDB and first-run bootstrap automatically.

**Architecture:** The panel becomes the control-plane authority backed by local MariaDB, while each daemon gets its own local MariaDB for operational state only. Web auth moves to secure server-side sessions, API keys remain for automation, and daemon bootstrap remains token-based.

**Tech Stack:** Fastify, Svelte, TypeScript, MariaDB/MySQL drivers and migrations, secure cookie sessions, Docker, systemd, Bash installers.

---

## File Structure Map

### Panel/API storage and auth

- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/src/app.ts`
- Replace: `apps/api/src/plugins/auth.ts`
- Replace: `apps/api/src/lib/store.ts`
- Remove/replace: `apps/api/src/lib/firebase.ts`
- Modify: `apps/api/src/seed.ts`
- Create: `apps/api/src/lib/db/panel.ts`
- Create: `apps/api/src/lib/db/panel-migrations.ts`
- Create: `apps/api/src/lib/repositories/users.ts`
- Create: `apps/api/src/lib/repositories/sessions.ts`
- Create: `apps/api/src/lib/repositories/api-keys.ts`
- Create: `apps/api/src/lib/repositories/nodes.ts`
- Create: `apps/api/src/lib/repositories/servers.ts`
- Create: `apps/api/src/lib/repositories/settings.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/lib/passwords.ts`

### Daemon local SQL

- Modify: `apps/daemon/src/config.ts`
- Create: `apps/daemon/src/lib/db/daemon.ts`
- Create: `apps/daemon/src/lib/db/daemon-migrations.ts`
- Create: `apps/daemon/src/lib/repositories/local-transfers.ts`
- Create: `apps/daemon/src/lib/repositories/local-backups.ts`
- Create: `apps/daemon/src/lib/repositories/sftp.ts`
- Create: `apps/daemon/src/lib/repositories/update-history.ts`

### Panel frontend auth/UI

- Remove/replace: `apps/panel/src/lib/firebase.ts`
- Replace: `apps/panel/src/lib/stores/auth.ts`
- Modify: `apps/panel/src/App.svelte`
- Modify: `apps/panel/src/app.css`
- Create or modify: `apps/panel/src/lib/components/*` as needed for login and session states

### Installers and docs

- Modify: `installers/panel/install.sh`
- Modify: `installers/panel/update.sh`
- Modify: `installers/daemon/install.sh`
- Modify: `installers/daemon/update.sh`
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Replace/remove: `docs/firebase-setup.md`
- Replace/remove: `docs/firestore-schema.md`
- Create: `docs/mariadb-setup.md`

### Tests

- Create/modify: `apps/api/src/**/*.test.ts`
- Create/modify: `apps/daemon/src/**/*.test.ts`
- Modify: `e2e/panel.spec.ts`
- Create: `installers/panel/install.test.ts`
- Create: `installers/daemon/install.test.ts`

## Task 1: Panel Database Foundation

**Files:**

- Create: `apps/api/src/lib/db/panel.ts`
- Create: `apps/api/src/lib/db/panel-migrations.ts`
- Modify: `apps/api/src/config.ts`
- Test: `apps/api/src/lib/db/panel.test.ts`

- [ ] **Step 1: Write the failing DB config and migration test**
- [ ] **Step 2: Add panel MariaDB config values and connection pool**
- [ ] **Step 3: Add migration runner for panel schema bootstrap**
- [ ] **Step 4: Run targeted DB tests**
- [ ] **Step 5: Commit**

## Task 2: Password Auth And Session Model

**Files:**

- Create: `apps/api/src/lib/passwords.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/lib/repositories/sessions.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/plugins/auth.ts`
- Test: `apps/api/src/routes/auth.test.ts`

- [ ] **Step 1: Write failing tests for login, logout, and session resolution**
- [ ] **Step 2: Add password hashing and verification helpers**
- [ ] **Step 3: Add SQL-backed session repository and secure cookie wiring**
- [ ] **Step 4: Replace Firebase bearer auth path with session auth for browser routes while preserving API key and daemon token flows**
- [ ] **Step 5: Run auth tests and commit**

## Task 3: SQL User, Role, And API Key Repositories

**Files:**

- Create: `apps/api/src/lib/repositories/users.ts`
- Create: `apps/api/src/lib/repositories/api-keys.ts`
- Modify: `apps/api/src/lib/store.ts` or split facade entrypoint
- Test: `apps/api/src/lib/repositories/users.test.ts`
- Test: `apps/api/src/lib/repositories/api-keys.test.ts`

- [ ] **Step 1: Write failing repository CRUD tests for users, roles, and API keys**
- [ ] **Step 2: Implement repository methods and compatibility facade used by current routes**
- [ ] **Step 3: Preserve hashed API key storage and one-time reveal semantics**
- [ ] **Step 4: Run targeted repository tests**
- [ ] **Step 5: Commit**

## Task 4: SQL Core Control-Plane Repositories

**Files:**

- Create: `apps/api/src/lib/repositories/nodes.ts`
- Create: `apps/api/src/lib/repositories/servers.ts`
- Create: `apps/api/src/lib/repositories/settings.ts`
- Modify: `apps/api/src/lib/store.ts`
- Test: `apps/api/src/lib/repositories/nodes.test.ts`
- Test: `apps/api/src/lib/repositories/servers.test.ts`

- [ ] **Step 1: Write failing tests for nodes, servers, settings, and core dashboard reads**
- [ ] **Step 2: Implement SQL repositories used by existing route/service layer**
- [ ] **Step 3: Preserve status derivation, permission checks, and audit writes**
- [ ] **Step 4: Run targeted repository tests**
- [ ] **Step 5: Commit**

## Task 5: Daemon Local MariaDB Foundation

**Files:**

- Create: `apps/daemon/src/lib/db/daemon.ts`
- Create: `apps/daemon/src/lib/db/daemon-migrations.ts`
- Modify: `apps/daemon/src/config.ts`
- Test: `apps/daemon/src/lib/db/daemon.test.ts`

- [ ] **Step 1: Write failing config and migration tests for daemon-local DB**
- [ ] **Step 2: Add daemon DB config, pool, and migration runner**
- [ ] **Step 3: Wire startup to ensure local schema exists**
- [ ] **Step 4: Run daemon DB tests**
- [ ] **Step 5: Commit**

## Task 6: Daemon Local Operational Repositories

**Files:**

- Create: `apps/daemon/src/lib/repositories/local-transfers.ts`
- Create: `apps/daemon/src/lib/repositories/local-backups.ts`
- Create: `apps/daemon/src/lib/repositories/sftp.ts`
- Create: `apps/daemon/src/lib/repositories/update-history.ts`
- Test: `apps/daemon/src/lib/repositories/*.test.ts`

- [ ] **Step 1: Write failing tests for local transfer, backup, SFTP, and update-history persistence**
- [ ] **Step 2: Implement daemon repositories and integration hooks at current operational boundaries**
- [ ] **Step 3: Preserve secret redaction and one-time credential reveal behavior**
- [ ] **Step 4: Run daemon repository tests**
- [ ] **Step 5: Commit**

## Task 7: Panel Frontend Auth Migration

**Files:**

- Remove/replace: `apps/panel/src/lib/firebase.ts`
- Replace: `apps/panel/src/lib/stores/auth.ts`
- Modify: `apps/panel/src/App.svelte`
- Test: `e2e/panel.spec.ts`

- [ ] **Step 1: Write failing browser tests for password login, session persistence, and logout**
- [ ] **Step 2: Replace Firebase client store with session-backed auth store**
- [ ] **Step 3: Replace Google sign-in UI with local login form while keeping mock login gated to dev mode**
- [ ] **Step 4: Run E2E auth tests**
- [ ] **Step 5: Commit**

## Task 8: Panel Installer MariaDB Bootstrap

**Files:**

- Modify: `installers/panel/install.sh`
- Modify: `installers/panel/update.sh`
- Create: `installers/panel/install.test.ts`
- Modify: `README.md`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Write failing installer tests for MariaDB install, DB/user creation, admin bootstrap prompt, and raw GitHub usage**
- [ ] **Step 2: Add MariaDB package installation and service enable/start logic**
- [ ] **Step 3: Add DB/user generation, migration execution, and first-admin bootstrap prompt**
- [ ] **Step 4: Add clear success output with raw one-line install examples**
- [ ] **Step 5: Run installer tests and commit**

## Task 9: Daemon Installer MariaDB Bootstrap

**Files:**

- Modify: `installers/daemon/install.sh`
- Modify: `installers/daemon/update.sh`
- Create: `installers/daemon/install.test.ts`
- Modify: `README.md`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Write failing installer tests for daemon-local MariaDB provisioning and one-line bootstrap command shape**
- [ ] **Step 2: Add local MariaDB install, DB/user creation, and migration execution**
- [ ] **Step 3: Preserve token-based registration while persisting daemon-local credentials and metadata**
- [ ] **Step 4: Add final output showing the raw GitHub one-line daemon install command format**
- [ ] **Step 5: Run installer tests and commit**

## Task 10: Firebase Removal Pass

**Files:**

- Remove/replace: `apps/api/src/lib/firebase.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/panel/package.json`
- Modify: `apps/api/src/seed.ts`
- Modify: `docs/firebase-setup.md`
- Modify: `docs/firestore-schema.md`

- [ ] **Step 1: Remove Firebase dependencies and imports**
- [ ] **Step 2: Replace remaining Firebase-specific seed/bootstrap logic with SQL equivalents**
- [ ] **Step 3: Remove Firebase docs and replace them with MariaDB/local-auth docs**
- [ ] **Step 4: Run repo-wide search to confirm no user-facing Firebase references remain**
- [ ] **Step 5: Commit**

## Task 11: Full Verification And Docs Pass

**Files:**

- Modify: `README.md`
- Modify: `docs/deployment.md`
- Create: `docs/mariadb-setup.md`
- Modify: `e2e/panel.spec.ts`

- [ ] **Step 1: Update install, update, and local-dev docs for MariaDB and session auth**
- [ ] **Step 2: Update E2E coverage for login, admin bootstrap, and one-time secret flows**
- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

- [ ] **Step 4: Fix any failures and rerun verification**
- [ ] **Step 5: Commit**

## Self-Review

- Spec coverage check:
  - SQL panel storage: covered by Tasks 1, 3, 4
  - secure session auth: covered by Tasks 2, 7
  - daemon-local SQL: covered by Tasks 5, 6, 9
  - one-line installers: covered by Tasks 8, 9
  - Firebase removal: covered by Task 10
  - docs and verification: covered by Task 11
- Placeholder scan:
  - No `TBD` or `TODO` placeholders included.
- Scope check:
  - The plan is still large, but it is one coherent migration bounded around storage/auth/installers rather than unrelated product features.
