# Audit Report — AgentIQ / Mission Control

**Date:** 2026-04-07
**Scope:** Full codebase — architecture, features, UX, reliability, performance, security
**Runtime Status:** App container crashes with out-of-memory (JS heap), Postgres auth errors, hermes-bridge container misconfigured (entrypoint issue)

---

## Executive Summary

AgentIQ is a multi-company dashboard (Mission Control) for managing AI-agent-run businesses. It uses a React + Vite frontend (port 5173), a Hono/Node.js API (port 3000), PostgreSQL via Drizzle ORM, all orchestrated by Docker Compose. The CEO orchestrator runs autonomously on a 30-second tick, processing tasks and making LLM-driven decisions.

**Confirmed blockers at present runtime:**
1. `NODE_OPTIONS` heap limit not set — API crashes with OOM (JS heap exhausted)
2. `DATABASE_URL` in docker-compose.yml uses `***` placeholder instead of actual password `postgres`
3. Hermes bridge cannot run as a Docker container (entrypoint=cmd mismatch)
4. Auth returns 500 (Internal Server Error) on login due to the DB password issue
5. `JWT_SECRET` defaults to `dev-secret-change-in-production` in production mode

**Overall feature maturity:** ~40% of declared features are functional. Many pages are UI scaffolds with CRUD wiring to real DB tables, but lack the integration layer (OpenClaw, Hermes execution, LLM decisions) to make them truly operational.

---

## Architecture Overview

### Stack
| Layer | Technology | Confirmed/Likely |
|-------|-----------|-----------------|
| Frontend | React 18 + React Router v7 + Vite | Confirmed |
| Styling | Inline styles (no CSS framework) | Confirmed |
| Backend | Hono + @hono/node-server on Node 20 | Confirmed |
| Database | PostgreSQL 16 (Drizzle ORM, postgres driver) | Confirmed |
| Auth | JWT (hono/jwt) — cookie-based, HS256 | Confirmed |
| Org chart UI | @xyflow/react (React Flow) | Confirmed |
| Testing | Vitest + jsdom + Testing Library | Confirmed |
| Deployment | Docker Compose only | Confirmed |
| Orchestrator | CEOOrchestrator class — 30s tick loop in server.ts | Confirmed |
| LLM Abstraction | Provider interfaces: OpenAI, Anthropic, OpenAI-compatible, Ollama | Confirmed |
| Task Execution | Dual paths: Hermes bridge (external) + local task-execution.ts (pattern-matching) | Confirmed |

### File inventory (production code, excluding tests/docs)
```
apps/api/src/
  index.ts          — Hono app, route registration, health endpoint
  server.ts         — Entry point: serves API, starts CEO orchestrator, cleanup timers
  db/schema.ts      — 18 Drizzle table definitions (users, companies, agents, tasks, etc.)
  db/client.ts      — Drizzle + postgres driver setup
  db/migrate.ts     — Drizzle migration runner
  middleware/auth.ts        — JWT verification with DB existence check
  middleware/audit-log.ts   — Audit logging for mutations
  middleware/rate-limiter.ts — In-memory per-IP rate limiting (5 req/15min)
  routes/auth.ts            — /auth/register, /auth/login, /auth/logout, /auth/me
  routes/dashboard.ts       — /companies (GET/POST), /dashboard/:companyId/stats
  routes/agents.ts          — Agents CRUD, activity/logs, skills, heartbeat
  routes/tasks.ts           — Tasks CRUD, approvals, execute
  routes/projects.ts        — Projects CRUD, stats
  routes/skills.ts          — Skills CRUD, agent-skill assignments
  routes/executions.ts      — Execution runs, events, result ingestion
  routes/chat.ts            — Chat messages CRUD, LLM-based response
  routes/calendar.ts        — Calendar events CRUD
  routes/journal.ts         — Journal entries CRUD
  routes/files.ts           — File upload/download (local disk storage)
  routes/llm.ts             — LLM provider CRUD (add, list, test, activate)
  routes/briefs.ts          — Company briefs CRUD
  routes/data.ts            — Generic aggregated data queries
  routes/realtime.ts        — Server-Sent Events (EventSource)
  routes/connectors.ts      — Connector platform registration + webhook endpoint
  routes/goals.ts           — Goals CRUD with progress tracking
  routes/agentLogs.ts       — Agent activity logs
  orchestrator/             — CEO autonomous loop (context, routing, LLM, action, report, monitor)
  llm/provider.ts           — Provider interfaces + implementations
  connectors/               — Connector registry (Hermes, OpenClaw)
  execution/dispatcher.ts   — Execution run creation + event/result recording
  utils/task-runner.ts      — CEO task execution wrapper
  utils/skillParser.ts      — Skill markdown parser
  utils/agentLogger.ts      — Agent activity logger
  task-execution.ts         — Local pattern-matching task executor (Hermes bypass)
  task-exec.ts             — DEPRECATED (kept for reference)

apps/web/src/
  App.tsx                   — React Router with 16 routes, all under DashboardLayout
  contexts/AuthContext.tsx  — JWT context, cookie-based, login/logout
  layouts/DashboardLayout.tsx — Sidebar nav, company selector, header
  pages/                    — 16 page components matching App.tsx routes

packages/shared/
  src/types.ts              — Exports Role type only (OWNER, CEO, AGENT)
  src/schemas.ts            — Zod schemas for auth, company, agent, task, connector
```

### Architecture concerns [Confirmed]
- **No API route prefix protection**: The `/health` endpoint at `apps/api/src/index.ts:39` has no auth middleware. It checks DB connectivity. This is acceptable for health checks, but all `/api/*` routes depend on authMiddleware being applied per-router, which is done inconsistently.
- **Auth middleware not applied globally**: Routes are registered at `/api` level, but authMiddleware is applied per-router (each router calls `router.use(authMiddleware)`). The `/api/data` route and webhook endpoints (`/api/executions/:runId/events`, `/api/executions/:runId/result`) do NOT use auth middleware. The webhook endpoints have their own token check, but `/api/data` has no auth at all.
- **No CSRF protection**: Cookie-based auth with `sameSite: Strict` reduces CSRF risk, but there's no explicit CSRF token.

---

## Feature Status Matrix

| Feature | Route | API Routes | Status | Confidence |
|---------|-------|-----------|--------|-----------|
| Registration/Login | /login | POST /auth/register, /auth/login, /auth/logout, /auth/me | Partially operational | Confirmed |
| Company list + create | /dashboard | GET/POST /companies | Partially operational | Confirmed |
| Dashboard stats | /dashboard | GET /dashboard/:companyId/stats | Partially operational | Confirmed |
| Agent management | /agents | GET/POST/PUT/DELETE /companies/:id/agents, /agents/:id/activity | Partially operational | Confirmed |
| Org chart | /org | GET /companies/:id/agents (reused) | Partially operational | Likely |
| Task board | /tasks | GET/POST/PUT/DELETE /tasks, /tasks/approvals, /tasks/:id/approve | Partially operational | Confirmed |
| Task history | /history | GET /history, GET /reports/daily | Partially operational | Likely |
| Reports | /reports | GET /reports/daily (in reports route) | Partially operational | Likely |
| Projects | /projects | GET/POST/PUT/DELETE /companies/:id/projects | Confirmed functional | Confirmed |
| Skills | (embedded in Agents page) | GET/POST/PUT/DELETE /skills, /agents/:id/skills | Partially operational | Likely |
| CEO orchestration | Server-side | No direct routes; runs in-process | Non-functional (crashes OOM) | Confirmed |
| Chat/AI assistant | /chat | GET/POST /chat/messages, /chat/:companyId/agents | Partially operational | Likely |
| Journal | /journal | GET/POST/DELETE /journal | Confirmed functional | Confirmed |
| Calendar | /calendar | GET/POST/PUT /calendar | Confirmed functional | Confirmed |
| File hub | /files | GET/POST /files | Partially operational | Confirmed |
| LLM provider config | /brain | GET/POST/PUT /llm/providers, /llm/test | Partially operational | Likely |
| Company briefs | /brief | GET/POST/PUT DELETE /briefs | Confirmed functional | Confirmed |
| Connectors | /integrations | Webhook endpoints for openclaw/hermes | Present but incomplete | Confirmed |
| Goals | (likely embedded in dashboard) | GET/POST/PUT/DELETE /goals | Confirmed functional | Confirmed |
| Hermes execution bridge | Background | POST /executions, POST /executions/:id/events, POST /executions/:id/result | Non-functional (container fails) | Confirmed |

---

## Confirmed Findings

### CRITICAL (blocking, proven by code/runtime)

1. **DATABASE_URL uses `***` placeholder in docker-compose.yml** (line 32, 45)
   - The `***` is not a password — Postgres rejects it with authentication error `28P01`
   - Affects: Every single API call, all runtime operations
   - Evidence: Log output showing `password authentication failed for user "postgres"`

2. **API crashes with JavaScript heap out of memory**
   - The Dockerfile CMD runs `CI=true pnpm install && pnpm -C apps/api exec tsx src/db/migrate.ts && (pnpm -C apps/api exec tsx src/server.ts & pnpm -C apps/web dev --host 0.0.0.0)`
   - No NODE_OPTIONS set, defaulting to ~512MB-1GB on node:20-alpine
   - Node.js v20 OOM kills the process but Vite stays alive, leaving port 3000 dead
   - Evidence: Logs showing `FATAL ERROR: Reached heap limit Allocation failed`

3. **Hermes bridge container fails at startup**
   - `entrypoint` from base node:20-alpine image (`docker-entrypoint.sh node`) is not overridden
   - When Docker Compose passes `command: ["sh", ...]` it prepends to entrypoint creating `node /app/sh`
   - The previous fix added `command: ["sh", "-c", ...]` with `--build` is needed because the Docker image has `CMD` (not ENTRYPOINT) but compose config was stale
   - Evidence: `Cannot find module '/app/bash'` and `Cannot find module '/app/sh'`

4. **JWT_SECRET defaults to insecure value in production**
   - File: `apps/api/src/middleware/auth.ts:8` — `JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production"`
   - The guard at line 10 throws only when `NODE_ENV === "production"`, but docker-compose sets `NODE_ENV=development` (from .env.example)
   - Evidence: JWT_SECRET is `dev-secret-change-in-production`, a well-known string anyone can guess

5. **Auth routes have `***` corruption in source display**
   - File: `apps/api/src/routes/auth.ts:13,14,18,22` display as `const auth=*** Hono()` and `const token=***`
   - This appears to be terminal output sanitization of the string `new`, but if the actual file contains `***` characters, the code won't compile. However, given the app DID run before OOM, the code compiles, so the `***` is display corruption — but this makes future maintenance and code review unreliable.
   - Requires runtime file inspection to confirm actual bytes.

### HIGH

6. **`/api/data` route has NO auth middleware**
   - File: `apps/api/src/routes/data.ts`
   - The router never calls `data.use(authMiddleware)` (unlike all other routers)
   - All data queries (companies, agents, tasks, events) expose company-scoped data without authentication
   - Evidence: No `authMiddleware` import or `.use()` call in data.ts

7. **N+1 query pattern in task router**
   - File: `apps/api/src/routes/tasks.ts:47-53`
   - After fetching N tasks, it does a separate query for agent names: `db.select().from(agents).where(... IN agentIds)`
   - This is technically O(1) extra query, but the pattern of fetching tasks THEN enriching is repeated across multiple routes (tasks, agents, calendar, files)
   - Impact: Multiple sequential queries on every request

8. **Company members JOIN on every route**
   - File: `apps/api/src/routes/dashboard.ts:21`, tasks.ts:35, agents.ts:28, etc.
   - Every route does `innerJoin(companyMembers)` to scope queries to the user's companies
   - No index on `companyMembers.userId` or `companyMembers.companyId` is defined in the schema
   - Impact: Table scan on company_members for every request

9. **Duplicate import of `sql` in index.ts**
   - File: `apps/api/src/index.ts:4,37`
   - `import { sql } from "drizzle-orm"` appears twice
   - Harmless but indicates sloppy code review

10. **Missing DELETE endpoints for several resources**
    - Tasks: No `DELETE /tasks/:taskId` route exists
    - Agents: `DELETE /agents/:agentId` exists but has no cascade logic for linked tasks, logs, execution runs
    - Skills: `DELETE /skills/:skillId` exists but doesn't clean up `agentSkills` join table rows
    - Evidence: grep for DELETE in route files

---

## Suspected Findings (Requires Runtime Verification)

11. **Drizzle migrations may not be synced with schema.ts**
    - File: `apps/api/src/db/migrate.ts`
    - The schema has 18 tables but we cannot verify `drizzle.config.ts` or migration files exist
    - Missing column on `executionRuns` table (missing `scratchpad` which is referenced in hermes-bridge.ts)
    - Requires: Run `drizzle-kit generate --diff` or inspect migration directory

12. **`executionRuns.companyId` — likely missing column**
    - Schema line 162: `companyId: uuid("company_id").notNull().references(() => companies.id)`
    - This is defined in schema.ts but we cannot confirm it exists in the running DB
    - Evidence: Hermes bridge code fetches `companyId` from projects/tasks JOIN rather than from executionRuns directly, suggesting the column may not exist at runtime

13. **CEO orchestrator crash behavior**
    - `apps/api/src/server.ts:17` calls `startCEOOrchestrator()` which starts immediately on server boot
    - If the orchestrator encounters an uncaught exception in its tick, it logs to console but the setInterval continues
    - However, the OOM crash kills the entire process including the orchestrator
    - Requires: Verify orchestrator survives individual tick failures

14. **SSE /realtime endpoint may not work behind Docker Compose**
    - File: `apps/api/src/routes/realtime.ts`
    - Server-Sent Events require persistent connections — the API server + Vite proxy may close idle connections
    - Requires: Verify SSE connection persists for >60s

---

## UX/UI Issues

15. **All inline styles — no design system**
    - Every page component uses inline style objects with hardcoded colors, padding, etc.
    - Duplicate patterns across 16+ pages (same input styles, same button styles, same modal patterns)
    - Theme toggle exists (`ThemeToggle.tsx`) but appears to only toggle a class — actual inline styles don't respond to it
    - Evidence: grep for `style={{` across all page files

16. **No loading states visible in code**
    - Pages fetch data with `fetch()` + `useEffect` + `useState`
    - No loading state displayed during fetch (empty arrays or undefined render immediately)
    - Evidence: DashboardPage, AgentsPage, TaskBoard all set state with `setX(data)` without a `setLoading(true)` pattern

17. **No error boundaries on individual pages**
    - App.tsx wraps everything in ErrorBoundary, but individual route components lack error boundaries
    - A single page crash brings down the entire app
    - Evidence: Only App.tsx and one nested route in App.tsx:89 use ErrorBoundary

18. **No empty states**
    - When company/agents/tasks arrays are empty, pages render nothing or a blank list
    - No "Get started" or "Create your first..." prompts
    - Evidence: No conditional `if (items.length === 0)` with friendly messaging in any page

19. **Company wizard assumes fresh company**
    - CompanyWizard.tsx creates a company + projects + agents in one flow
    - If registration created a company (via `/auth/register`), the wizard creates a duplicate
    - Evidence: Registration creates a company with name + "General Operations" project + "Founder" agent

20. **No pagination in any list view**
    - All GET endpoints return all rows (limited to 500 max in some routes)
    - No cursor-based or offset pagination
    - Evidence: `limit: 500` hardcoded in multiple routes

---

## Reliability Issues

21. **Unbounded in-memory rate limiter**
    - File: `apps/api/src/middleware/rate-limiter.ts`
    - The `attempts` Map grows unbounded — cleanup only runs every 60s via setInterval
    - During an attack, memory could grow significantly
    - Note: This IS cleaned up every 60s by `cleanupRateLimiter()` in server.ts

22. **No retry or exponential backoff for failed executions**
    - File: `apps/api/src/execution/dispatcher.ts`
    - If Hermes dispatch fails, the execution run is re-queued but with no retry limit
    - File: `apps/api/src/routes/tasks.ts` — `retryCount` field exists but isn't incremented or checked
    - Evidence: `retryCount` column in schema (line 74), but never read in any route or orchestrator

23. **Silent skill assignment failures**
    - File: `apps/api/src/routes/agents.ts:103-112`
    - Skill assignment loop catches errors and silently skips: `try { await db.insert(...) } catch { /* skip */ }`
    - No logging, no user feedback

24. **`task-execution.ts` pattern-matching executor is brittle**
    - File: `apps/api/src/task-execution.ts`
    - Task execution is based on keyword matching in title/description: `if (fullText.includes("hire") ...)`
    - Easily triggered by false positives (e.g., a task "Review hiring policy" triggers the hiring flow)
    - No LLM-based intent classification — despite having an LLM provider layer

25. **`task-exec.ts` is dead code**
    - File: `apps/api/src/task-exec.ts`
    - Marked as DEPRECATED in comments but still imported by `utils/task-runner.ts`
    - The module-level comment says "Not wired into server.ts" but server.ts starts the orchestrator which uses task-runner which... may or may not use this

26. **No transaction wrapping for task creation**
    - File: `apps/api/src/routes/tasks.ts:82-88`
    - Task insert is not wrapped in a transaction — if subsequent operations fail, the orphaned task remains
    - Contrast with `dashboard.ts:52` which properly uses `db.transaction()`

---

## Performance Findings

27. **No database indexes defined**
    - Schema uses only `primaryKey()` and `.unique()` — no `.index()` calls
    - All foreign key columns lack indexes (companyId, projectId, agentId, userId, taskId)
    - Impact: Full table scans on JOINs for every query

28. **`pnpm install` runs on every container start**
    - Dockerfile cmd: `CI=true pnpm install && pnpm -C apps/api exec tsx src/db/migrate.ts && ...`
    - This runs on every container restart, adding 30-60s to startup
    - Impact: Slow development iteration and redeployment

29. **Vite dev server runs in production Docker**
    - The Dockerfile doesn't distinguish dev and production — it always starts both `tsx src/server.ts` (API) and `pnpm -C apps/web dev --host` (Vite)
    - Vite dev server includes HMR, source maps, and full source — significant overhead
    - A production Dockerfile (`Dockerfile.production`) exists but is not used by docker-compose.yml

30. **No request caching or response caching**
    - Every GET request hits the database directly
    - Dashboard stats, company lists, agent lists are queried on every page load with no caching
    - Evidence: No Redis or in-memory cache layer for GET responses

---

## Security Findings

31. **Exposed secrets in source code**
    - `DATABASE_URL` contains hardcoded password in docker-compose.yml (line 32): `postgresql://postgres:***@...`
    - File: `apps/api/src/db/client.ts:4` — same pattern with `postgres:***`

32. **JWT secret is guessable in development**
    - `dev-secret-change-in-production` is the fallback
    - Anyone on the same network can forge tokens for any user
    - No token rotation or revocation

33. **No rate limiting on non-auth routes**
    - Rate limiter is only applied to `/auth/register` and `/auth/login` (manually checked in auth.ts)
    - Other mutation endpoints (POST /companies, POST /agents, POST /tasks) have no rate limiting
    - Evidence: `rateLimitMiddleware` is imported only in auth.ts

34. **API keys stored in plaintext**
    - File: `apps/api/src/db/schema.ts:214` — `apiKey: text("api_key")` in llmProviders table
    - No encryption at rest for API keys
    - LLM provider API keys returned in API responses (need to verify if filtered server-side)

35. **File upload has no virus/type scanning**
    - File: `apps/api/src/routes/files.ts`
    - Files are saved to disk with sanitized names but no content type verification
    - 50MB size limit exists (good), but no file extension whitelist

36. **IDOR potential on several endpoints**
    - Some endpoints check company membership after fetching by ID, but the pattern is inconsistent:
      - `GET /agents/:id/skills` checks company membership
      - `PUT /agents/:id` checks company membership
      - But `GET /agents` returns ALL agents for ALL user's companies in one call — information disclosure across companies
    - Evidence: `dashboard.ts:11` — returns all companies for user without filtering by active context

---

## Integration and Dependency Risks

37. **OpenClaw connector is stub-only**
    - File: `apps/api/src/connectors/openclaw.ts`
    - Has validateWebhook, normalizeEvent, discoverAgents, autoConfigure
    - BUT discoverAgents only fetches `/api/agents` — no actual OpenClaw integration is wired upstream
    - Webhook endpoint exists in connectors.ts:132 but never creates events, agents, or tasks from incoming webhooks

38. **Hermes dispatch is one-way**
    - The bridge pushes queued runs to Hermes via webhook
    - Hermes reports back via `/api/executions/:runId/events` and `/api/executions/:runId/result`
    - BUT the bridge only polls for `queued` status — if Hermes takes longer than the poll interval, duplicate dispatches may occur
    - Evidence: `hermes-bridge.ts:17` — only checks `status = 'queued'`, doesn't transition to prevent re-dispatch

39. **No health check on the orchestrator**
    - `startCEOOrchestrator()` starts an interval with no monitoring
    - If the interval callback throws, it's caught and logged, but there's no alerting or restart mechanism
    - The orchestrator can be silently broken while the API serves requests normally

---

## Top Priorities

1. Fix DATABASE_URL password — immediate blocker for all operations
2. Fix OOM crash — set NODE_OPTIONS max-old-space-size
3. Fix hermes-bridge Docker configuration
4. Add auth middleware to /api/data route (security vulnerability)
5. Replace hardcoded JWT_SECRET with proper secret generation
6. Fix entrypoint/command for hermes-bridge container
7. Add database indexes on foreign key columns
8. Implement proper pagination for list endpoints
9. Add error boundaries and loading states to frontend
10. Clean up dead code (task-exec.ts, unused routes)

## Unknowns and Blockers

- **Migration state**: Cannot verify if DB schema matches schema.ts (no migration files visible, no drizzle.config.ts found)
- **LLM provider configuration**: `/brain` page exists but cannot test if LLM calls actually work (no API key configured)
- **SSE /realtime endpoint**: Cannot verify persistent connection works behind Docker Compose networking
- **File storage at scale**: Local disk storage works for dev but has no cloud storage provider fallback
- **Multi-company isolation**: Users can be members of multiple companies, but there's no "active company" context selection in the auth flow — all queries return data from ALL companies the user belongs to
- **audit_log table**: Middleware inserts into `audit_log` table but this table is NOT defined in schema.ts — likely a runtime error on first mutation
