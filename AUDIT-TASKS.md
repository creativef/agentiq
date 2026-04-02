MISSION CONTROL - PRIORITIZED TASK BACKLOG
Generated: 2026-04-02
Source: AUDIT-REPORT.md
Total Tasks: 25

========================================================================
P0 - CRITICAL (Must fix immediately. Blocks security/production readiness)
========================================================================

T-01 | MOUNT TASKS ROUTER
Severity: Critical
Files: apps/api/src/index.ts, apps/api/src/routes/tasks.ts
Description: routes/tasks.ts contains full CRUD logic but is never imported or mounted in the main Hono app. All 3 frontend task pages hit 404 or show placeholders.
Steps to fix:
  1. Add `import { tasksRouter } from "./routes/tasks";` to index.ts
  2. Add `app.route("/api", tasksRouter);` below other route mounts
  3. Verify with: curl -H "Cookie: token=..." http://localhost:3000/tasks
Effort: 5m

T-02 | SECURE UNPROTECTED DATA ENDPOINTS
Severity: Critical
Files: apps/api/src/routes/data.ts, apps/api/src/index.ts
Description: /companies and /events routes in data.ts bypass authMiddleware. Any unauthenticated request can dump all company names and event payloads.
Steps to fix:
  1. Add `import { authMiddleware } from "../middleware/auth";`
  2. Add `data.use(authMiddleware);` before route definitions
  3. Filter queries by user's company membership (use existing pattern from dashboard.ts)
  4. Remove routes/data.ts if duplicated by dashboard.ts (recommended)
Effort: 30m

T-03 | SECURE OPENCLAW WEBHOOK ENDPOINT
Severity: Critical
Files: apps/api/src/routes/openclaw.ts
Description: POST /connectors/openclaw accepts any payload from the internet. No auth, no secret validation, no companyId extraction. Vulnerable to event table flooding.
Steps to fix:
  1. Add webhook secret verification: `if (c.req.header("X-Webhook-Secret") !== process.env.OPENCLAW_SECRET) return c.json({error: "Forbidden"}, 403);`
  2. Extract companyId from payload or query param
  3. Use normalizeEvent() from connectors/openclaw.ts
  4. Add companyId and agentId to db.insert
Effort: 1h

T-04 | ADD AUTHORIZATION TO AGENT PUT/DELETE
Severity: Critical
Files: apps/api/src/routes/agents.ts (lines 93-113)
Description: PUT /agents/:id and DELETE /agents/:id have NO company membership checks. Any authenticated user can modify or delete ANY agent across ALL companies.
Steps to fix:
  1. Before update/delete, query: `SELECT company_id FROM agents WHERE id = $1`
  2. Verify user has companyMembers record for that company_id
  3. Return 403 if unauthorized
  4. Add to audit log/event if desired
Effort: 1h

T-05 | REPLACE DEFAULT JWT SECRET IN PRODUCTION
Severity: Critical
Files: apps/api/src/middleware/auth.ts, docker-compose.yml
Description: JWT_SECRET defaults to "dev-secret-change-in-production". If deployed to prod without override, all tokens are forgeable.
Steps to fix:
  1. In docker-compose.yml, change to `JWT_SECRET: ${JWT_SECRET}`
  2. Add to .env.example: `JWT_SECRET=<generate 32+ char random string>`
  3. Add runtime check: `if (JWT_SECRET === "dev-secret-change-in-production" && process.env.NODE_ENV === "production") throw new Error(...)`
  4. Use `openssl rand -hex 32` to generate
Effort: 15m

========================================================================
P1 - HIGH (Core functionality & data integrity)
========================================================================

T-06 | IMPLEMENT PLACEHOLDER PAGES (Tasks, Agents, Calendar, Files, Chat, Org)
Severity: High
Files: apps/web/src/App.tsx, apps/web/src/pages/*.tsx
Description: 6 of 8 top-level routes render dead `<h1>` or "Coming soon" placeholders. Routes exist in sidebar but do nothing.
Steps to fix:
  1. App.tsx: Replace `<Placeholder name="Tasks" />` with `<TaskBoard />`, etc.
  2. Implement TaskBoard.tsx: Fetch /tasks, render kanban/table
  3. Implement Agents page: Fetch /agents, render cards with status
  4. Stub out Calendar/Files/Chat with proper loading/error states, not raw HTML
  5. Add error boundaries around each route
Effort: 12-16h

T-07 | CONNECT DASHBOARD TO LIVE DATA (Remove Mocks)
Severity: High
Files: apps/web/src/components/Overview/*.tsx (KpiTiles, StatusWall, OpsTimeline, QuickActions, CompanyPanel), apps/web/src/lib/api.ts
Description: All overview components display hardcoded mock values. DashboardPage.tsx works and fetches live data, but if OpsDashboard is ever routed to, users see fake metrics.
Steps to fix:
  1. Convert KpiTiles: Accept props {agents, stats} or fetch from /dashboard endpoint
  2. Convert StatusWall: Render actual agents with status colors from API
  3. Convert OpsTimeline: Map events.timeline to timeline items with timestamps
  4. Connect QuickActions to actual routes/actions
  5. Remove orphaned Sidebar.tsx and use DashboardLayout's implementation
Effort: 4-6h

T-08 | FIX DASHBOARD ERROR HANDLING & USER FEEDBACK
Severity: High
Files: apps/web/src/pages/DashboardPage.tsx
Description: `.catch(console.error)` silently swallows fetch failures. Users see stale data with no indication of API failure or Postgres downtime.
Steps to fix:
  1. Add `error` state to component
  2. Replace catch with `catch(err => setError(err.message))`
  3. Add UI: if error, show retry banner with "Something went wrong. Retry?"
  4. Add loading skeleton instead of "Loading..." text
  5. Implement exponential backoff retry for transient failures
Effort: 2h

T-09 | FIX OPENCLAW CONNECTOR INTEGRATION
Severity: High
Files: apps/api/src/connectors/openclaw-poll.ts, apps/api/src/connectors/openclaw.ts, apps/api/src/routes/openclaw.ts
Description: pollGateway returns empty array. normalizeEvent exists but is unused. Route only stores {type} with no companyId/agentId.
Steps to fix:
  1. Implement pollGateway to call actual OpenClaw API/Websocket
  2. Wire normalizeEvent into openclaw route handler
  3. Map OpenClaw event types to local event schema
  4. Add retry logic for polling failures
Effort: 4-8h

T-10 | ADD INPUT VALIDATION TO ALL POST ROUTES
Severity: High
Files: All route files with POST handlers (auth, dashboard, agents, tasks, companies)
Description: Zero Zod/schema validation on request bodies. Invalid/null payloads reach Drizzle queries, causing 500 errors or silent data corruption.
Steps to fix:
  1. Install zod in api package: `pnpm add zod -C apps/api`
  2. Create schemas per route (e.g., loginSchema, createAgentSchema)
  3. Add validation middleware or inline `schema.parse(body)` before DB calls
  4. Return 400 with field-level errors on validation failure
Effort: 4-6h

========================================================================
P2 - MEDIUM (UX, performance, stability)
========================================================================

T-11 | ADD PASSWORD STRENGTH & EMAIL VALIDATION
Severity: Medium
Files: apps/api/src/routes/auth.ts, apps/web/src/pages/Login.tsx
Description: Accepts any string for email and password. No format checks, no strength requirements.
Steps to fix:
  1. Backend: Add `email.endsWith('@')` or use zod email()
  2. Backend: Enforce password min 8 chars, mixed case, number
  3. Frontend: Add real-time validation feedback below inputs
  4. Add debounced email uniqueness check on registration
Effort: 1-2h

T-12 | IMPLEMENT CSRF PROTECTION OR SWITCH TO BEARER TOKENS
Severity: Medium
Files: apps/api/src/middleware/auth.ts, apps/web/src/contexts/AuthContext.tsx
Description: Using httpOnly cookies without CSRF tokens. Vulnerable if served over HTTP or if any XSS exists.
Steps to fix:
  Option A (Simpler): Switch to Authorization: Bearer <token> in fetch headers. Store in memory only.
  Option B (Keep cookies): Add Double Submit Cookie or SameSite=Strict + verify Origin header
  Recommended: Option B for better UX, Option A for simplicity
Effort: 2-3h

T-13 | ADD DATABASE INDEXES
Severity: Medium
Files: apps/api/src/db/migrate.ts
Description: No indexes on foreign keys. Queries like `WHERE company_id = $1` will full-scan at scale.
Steps to fix:
  1. Add: `CREATE INDEX idx_tasks_project_id ON tasks(project_id);`
  2. Add: `CREATE INDEX idx_agents_company_id ON agents(company_id);`
  3. Add: `CREATE INDEX idx_events_company_id ON events(company_id);`
  4. Add: `CREATE INDEX idx_company_members_user_id ON company_members(user_id);`
  5. Add to migrate.ts and run
Effort: 30m

T-14 | ADD PAGINATION TO HEAVY ENDPOINTS
Severity: Medium
Files: apps/api/src/routes/dashboard.ts (events), apps/api/src/routes/data.ts
Description: `limit(50)` hardcodes event count. No cursor/offset for load-more. Dashboard crashes if events table has 10k+ rows.
Steps to fix:
  1. Accept query params: `?limit=20&offset=0`
  2. Use `c.req.query("limit")` with default 20, max 100
  3. Return `{events, hasMore}` response
  4. Frontend: Add "Load more" button or infinite scroll
Effort: 2h

T-15 | IMPLEMENT RESPONSIVE DESIGN
Severity: Medium
Files: apps/web/src/layouts/DashboardLayout.tsx, apps/web/src/pages/DashboardPage.tsx
Description: Fixed 240px sidebar. Breaks on tablets/phones. No mobile nav toggle.
Steps to fix:
  1. Add CSS media queries: `@media (max-width: 768px) { .sidebar { display: none; } }`
  2. Add hamburger menu button for mobile
  3. Use flex-wrap on KPI grid
  4. Test on 375px, 768px, 1024px viewports
Effort: 3-4h

T-16 | FIX THEME TOGGLE PERSISTENCE
Severity: Medium
Files: apps/web/src/components/ThemeToggle.tsx
Description: Defaults to "light" on every reload. Never reads localStorage. Never applies theme class to document.
Steps to fix:
  1. On mount: `const stored = localStorage.getItem("theme") || "light"`
  2. Apply: `document.documentElement.dataset.theme = stored`
  3. On toggle: `setTheme(next); localStorage.setItem("theme", next);`
  4. Respect prefers-color-scheme as fallback
Effort: 30m

========================================================================
P3 - LOW (Tech debt, polish, testing)
========================================================================

T-17 | REMOVE UNUSED COMPONENTS & CODE
Severity: Low
Files: Sidebar.tsx, TopBar.tsx, OpsDashboard.tsx, task files, calendar stubs
Description: 7 components are imported but never rendered. Sidebar duplicates DashboardLayout. Increases bundle size and confusion.
Steps to fix:
  1. Delete Sidebar.tsx, TopBar.tsx
  2. Either remove OpsDashboard.tsx or route it to /overview
  3. Remove stub implementations or mark clearly as WIP
  4. Run `pnpm lint` (add eslint if missing) to catch unused imports
Effort: 1h

T-18 | CLEAN UP DEPENDENCY DUPLICATION
Severity: Low
Files: apps/web/package.json
Description: Both react-router and react-router-dom installed. React Router v7 merged them; only one needed.
Steps to fix:
  1. `pnpm remove react-router-dom -C apps/web`
  2. Keep react-router (v7)
  3. Verify all imports still resolve
  4. Run `pnpm install` to clean lockfile
Effort: 15m

T-19 | ADD ESLINT + PRETTIER + TS STRICT MODE
Severity: Low
Files: tsconfig.base.json, root package.json
Description: No linting, no formatting, TypeScript not in strict mode. Silent type errors possible.
Steps to fix:
  1. `pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier`
  2. Enable strict: true in tsconfig.base.json
  3. Add .eslintrc and .prettierrc
  4. Add scripts: "lint", "format", "typecheck"
  5. Run once across codebase, fix violations
Effort: 2-3h

T-20 | ADD E2E TESTS
Severity: Low
Files: apps/web/tests/
Description: Only unit/component tests exist. No end-to-end flow validation (login -> dashboard -> company switch).
Steps to fix:
  1. Install Playwright or Cypress
  2. Write test: Register user -> Login -> Verify dashboard loads -> Create second company -> Switch -> Verify data updates
  3. Add to CI pipeline
Effort: 4-6h

T-21 | ADD RATE LIMITING TO AUTH ENDPOINTS
Severity: Low
Files: apps/api/src/routes/auth.ts
Description: No rate limiting on /auth/login or /auth/register. Vulnerable to credential stuffing and spam.
Steps to fix:
  1. Add `hono-rate-limiter` or simple in-memory map: `const attempts = new Map()`
  2. Limit to 5 attempts per IP per 15 minutes
  3. Return 429 Too Many Requests when exceeded
  4. Clear attempts on successful login
Effort: 1-2h

T-22 | IMPROVE DOCKERFILE FOR PRODUCTION
Severity: Low
Files: Dockerfile
Description: Uses `CMD ["pnpm install && ..."]` in one-shot container. No multi-stage build, large image, dev dependencies included.
Steps to fix:
  1. Create multi-stage: builder -> runner
  2. Install only production deps in runner stage
  3. Add healthcheck: `HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health`
  4. Use `pnpm run build` for web, serve static files or keep vite for dev only
Effort: 2-3h

T-23 | ADD AUDIT LOGGING
Severity: Low
Files: apps/api/src/index.ts or middleware/
Description: No record of who created/deleted agents or changed company settings.
Steps to fix:
  1. Add middleware that logs: `{method, path, userId, timestamp, ip}`
  2. Write to separate audit_log table or stderr for now
  3. Filter out /health and static requests
Effort: 1-2h

T-24 | ADD GOALS API ROUTES
Severity: Low
Files: apps/api/src/routes/goals.ts (new), apps/api/src/index.ts
Description: goals table exists in DB with parentId/progress fields, but no API routes expose or mutate it. Dashboard shows hardcoded "Goal Progress".
Steps to fix:
  1. Create routes/goals.ts following dashboard.ts pattern
  2. GET /companies/:id/goals, POST, PUT, DELETE
  3. Mount in index.ts
  4. Connect to dashboard or company settings page
Effort: 3-4h

T-25 | ADD FAVICON & META TAGS
Severity: Low
Files: apps/web/index.html
Description: Barebones HTML. No favicon, no OG tags, no viewport meta properly set.
Steps to fix:
  1. Add `<meta name="viewport" content="width=device-width, initial-scale=1">`
  2. Add `<link rel="icon" href="/favicon.ico">`
  3. Add `<title>Mission Control</title>`
  4. Add Open Graph tags for sharing
Effort: 15m

========================================================================
COMPLETION CHECKLIST
========================================================================

[ ] P0 tasks completed (Security & Broken Routes)
[ ] P1 tasks completed (Core Features & Data Integrity)
[ ] P2 tasks completed (UX, Error Handling & Performance)
[ ] P3 tasks completed (Tech Debt & Polish)
[ ] Full regression test passed
[ ] Audit report verified as accurate
[ ] Ready for Phase 2 review
