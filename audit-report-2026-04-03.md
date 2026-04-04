# Audit Report — Mission Control (AgentIQ)

**Date:** 2026-04-03  
**Commit audited:** 40f59c2 (latest on `main`)  
**Method:** Static code analysis only. No runtime verification performed in this session.  
**Confidence level:** High for code structure and wiring; Medium for runtime correctness (untested).

---

## Executive Summary

**Overall assessment:** Phase 2 MVP — core scaffolding is architecturally sound with complete multi-company hierarchy (Company → Projects → Agents with reporting chains), functional wizard-driven onboarding, and extensible connector/skill system. However, several critical routes return stub data, key UI pages lack live data, and the calendar/chat/files backends are minimal.

**Highest-risk areas:**
1. **Calendar/Chat/Files backends** — return `{ok: true}` or empty lists; no DB tables, no real logic (Confirmed)
2. **Realtime endpoint** — returns empty string; no SSE/WebSocket (Confirmed)
3. **Auth session guard** — added in last session but untested against DB wipe scenarios (Requires runtime verification)
4. **Skills import** — parser written, endpoint added, but never tested with real GStack-format markdown (Unverified)

**Core blockers to production readiness:**
- Calendar/Chat/Files have no DB storage layer (3 of 9 routes are stubs)
- No file upload handling (FileHub uploads to nowhere)
- No E2E tests, no load testing

---

## Architecture Overview

| Aspect | Detail |
|--------|--------|
| **Framework (frontend)** | React 18 + React Router v7 + Vite 8 |
| **Framework (backend)** | Hono.js 4.5 + @hono/node-server |
| **Database** | PostgreSQL 16 (Docker Compose) |
| **ORM** | Drizzle ORM 0.36 + `postgres` 3.4 |
| **Auth** | JWT (hono/jwt) in httpOnly cookies, bcrypt hashing |
| **State** | React useState/useContext (no Redux/Zustand) |
| **Package manager** | pnpm v9 workspaces |
| **Infra** | Docker Compose (postgres + app containers) |
| **Test framework** | Vitest 2.1 (14 API tests + 13 web tests) |

**Entry points:**
- Frontend: `apps/web/src/main.tsx` → mounts `<App />`
- Backend: `apps/api/src/server.ts` → `serve({ fetch: app.fetch, port: 3000 })`
- Hono app: `apps/api/src/index.ts`

**State management:** Single `AuthProvider` via React Context, tracks user, company, projects, project. Persisted via localStorage for active company/project IDs.

**Config/environment dependencies:**
- `DATABASE_URL` (default: postgresql://postgres:postgres@localhost:5432/missioncontrol)
- `JWT_SECRET` (default: dev-secret-change-in-production — guarded in production)
- `OPENCLAW_WEBHOOK_SECRET` (unset = open webhook access via fallback)

---

## Feature Status Matrix

| Feature | Status | Confidence | Evidence | Blockers |
|---------|--------|------------|----------|----------|
| Auth (login/register/logout) | **Fully functional** | High | Full CRUD, bcrypt, JWT cookies, ProtectedRoute guard | None |
| Dashboard (KPIs, status wall, timeline) | **Fully functional** | High | Fetches /companies/:id/dashboard, renders live | None |
| Company management | **Fully functional** | High | GET/POST /companies, PUT /companies/:id | None |
| Agents (CRUD, edit, skills, reporting) | **Fully functional** | High | Full CRUD, reports_to, skill picker | None |
| Tasks (kanban CRUD, drag-drop) | **Fully functional** | High | Full CRUD API, wired frontend | None |
| Projects (CRUD, project scoping) | **Fully functional** | High | Full CRUD API, sidebar switcher, frontend scoping | None |
| Connectors/Integrations | **Fully functional** | High | Full CRUD, auto-config on wizard | Requires Hermes/OpenClaw to be running |
| Goals (CRUD API) | **Partially operational** | High | Full CRUD API exists, frontend page not wired | No UI page for goals yet |
| Org Chart | **Partially operational** | High | Uses reporting hierarchy, renders trees | Depends on agents having reportsTo set |
| Company Settings | **Partially operational** | High | Company edit works, member list from DB | Invite flow is alert() stub |
| Skills (library, assign, import) | **Partially operational** | High | CRUD + skill parser + endpoints | UI: only in agent edit mode, no standalone page |
| Calendar | **Non-functional** | High | Route returns empty list, no calendar_events table | Needs DB table, storage, real CRUD logic |
| Chat | **Non-functional** | High | Route returns empty list, no chat_messages table | Needs DB table, real CRUD logic |
| Files | **Non-functional** | High | POST returns {ok:true}, no upload, no GET list | Needs storage layer, multipart handling |
| Realtime events | **Non-functional** | High | Returns empty string, no SSE/WebSocket | Not implemented |
| Company Wizard (onboarding) | **Fully functional** | High | 4-step modal: details → projects → team → review | None |

---

## Confirmed Findings

### [HIGH] Calendar/Chat/Files have stub backends

**Evidence:**
- `routes/calendar.ts`: `GET /calendar` → `c.json({ events: [] })` (empty list always)
- `routes/chat.ts`: `POST /chat` → `c.json({ ok: true })` (stub, no storage)
- `routes/files.ts`: `POST /files` → `c.json({ ok: true })` (stub, no upload)
- `routes/journal.ts`: `GET /journal` → `c.json({ ok: true })` (stub)
- `routes/realtime.ts`: `GET /events` → `c.text("")` (empty string)

**Why this matters:** 5 of 11 route modules are non-functional. Frontend pages exist and render, but all API calls either return empty data or no-ops.

**Recommended fix:** Implement DB tables and CRUD for calendar_events, chat_messages, journal_entries, files metadata. Real-time: add SSE or WebSocket.

---

### [HIGH] Goals API has no frontend page

**Evidence:** `routes/goals.ts` has full CRUD (GET/POST/PUT/DELETE) with auth + company scoping. But `App.tsx` has no route for `/goals` and no nav item.

**Recommended fix:** Add `/goals` route and page in App.tsx + nav.

---

### [HIGH] Company Settings invite is a browser alert

**Evidence:** `CompanySettings.tsx` — `handleInvite` does `alert("Invitation feature coming soon")`. No POST endpoint exists for adding members.

**Recommended fix:** Implement `POST /companies/:id/members` endpoint, replace alert with real flow.

---

### [MEDIUM] Skills.md parser untested with real GStack format

**Evidence:** `utils/skillParser.ts` parses markdown with `##` headings and `- key: value` metadata lines. GStack uses per-directory `SKILL.md` files, not a single concatenated file. Parser will produce 0 skills from a GStack repo dump without modification.

**Recommended fix:** Add a GitHub repo importer that fetches each `**/SKILL.md` from a repo, uses directory names as skill names.

---

### [MEDIUM] Auth guard added but untested

**Evidence:** `middleware/auth.ts` now queries `users` table after JWT verification to catch stale sessions. No test exists for this path. `USER_MISSING` code return is new and not covered by any test.

**Requires runtime verification:** Test with wiped DB + stale cookie scenario.

---

### [MEDIUM] Agent skill picker loads all available skills on every edit open

**Evidence:** `AgentsPage.tsx` — `loadAvailableSkills()` fetches `/api/skills` every time skill picker is opened. No caching, no debouncing.

**Recommended fix:** Load once on component mount, not on picker open.

---

### [LOW] `rbac.ts` middleware is never mounted

**Evidence:** `middleware/rbac.ts` exists with `canAccess()` helper but is never imported or used in any route. `requireRole` in `auth.ts` is also unused.

**Recommended fix:** Either wire RBAC into routes that need it, or delete dead code.

---

### [LOW] `OpsDashboard.tsx` is not routed

**Evidence:** `pages/OpsDashboard.tsx` exists (5 components: KpiTiles, StatusWall, etc.) but is never imported in `App.tsx`. Not routed.

**Recommended fix:** Either route it to `/overview`, or delete. Contains no mock data (components are dead code, not rendered).

---

### [LOW] `lib/api.ts` is dead code

**Evidence:** `apps/web/src/lib/api.ts` exports `getCompanies()`, `getEvents()` — neither is imported anywhere in the current frontend. DashboardPage fetches directly.

**Recommended fix:** Delete dead file or use it.

---

## Findings Requiring Runtime Verification

| Finding | Why risky | What must be tested |
|---------|-----------|---------------------|
| Vite proxy forwards cookies to API | Dev/proxy config may strip cookies | DevTools Network → check cookie on /api/auth requests |
| Docker migration runs on every start | Repeated CREATE TABLE IF NOT EXISTS is safe but slow | Check container startup logs for migration duration |
| Skills import endpoint handles large markdown | No size limit, potential memory issue | Import 100skill skills.md via API |
| Auth middleware DB query adds latency | Every request does a users lookup | Benchmark /api/companies response time with and without guard |

---

## UX/UI Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| No loading skeletons anywhere | Low | All pages show "Loading..." text, no animated skeletons |
| DashboardPage fetches agents + dashboard separately | Medium | Two useEffects, could be combined; agents not scoped by project |
| Error states silently swallowed | Medium | DashboardPage uses `.catch(console.error)`, no user-facing error banner |
| Company Settings save shows toast before confirming persisted | Low | `handleSave` doesn't check `res.ok` before showing "Settings saved!" |
| CalendarMeetings has no loading state for fetch | Low | No `.finally(() => setLoading(false))` — fetch never sets loading false if it fails |
| No mobile-responsive testing confirmed | Low | Media queries added (768px) but unverified in runtime |

---

## Reliability Issues

| Issue | Severity | Evidence |
|-------|----------|----------|
| `CalendarMeetings.tsx` fetch never calls `.finally()` | Medium | If fetch throws, loading stays true forever |
| No retry logic on any fetch call | Medium | All 7 pages do single fetch, no retry on failure |
| AgentsPage loads skills on every edit open | Low | No caching of `/api/skills` response |
| `window.location.reload()` used 3 times | Low | FileHub, CalendarCreate, CompanyCreate — jarring UX |

---

## Performance Findings

| Issue | Impact | Evidence |
|-------|--------|----------|
| No database indexes on most FK columns | High at scale | schema.ts has no `index()` calls |
| No query pagination on list endpoints | Medium | `limit(50)` on events, `orderBy` with no cursor |
| Dashboard fetches all agents without project filter | Medium | `GET /companies/:id/agents` returns all agents |
| No React.memo or useMemo except TaskBoard | Low | Re-renders on every state change in DashboardPage |
| Vite proxy adds ~5ms per API request | Negligible | Dev-only, not production |

---

## Security Findings

| Issue | Severity | Evidence |
|-------|----------|----------|
| `GET /connectors/:platform/webhook` has no auth | Medium (by design) | Webhook endpoints shouldn't require auth for inbound |
| OpenClaw webhook `validateWebhook` returns true if no secret configured | Medium | `if (!secret) return true` in `connectors/openclaw.ts` |
| Password accepts "12345678" (no complexity beyond 8 chars) | Low | Regex checks for upper+lower+digit, but no length limit on max |
| No CSRF token on form submissions | Low | SameSite=Strict provides basic protection, no double-submit cookie |
| JWT has no revocation mechanism | Low | 30-day tokens remain valid after logout until expiry |
| `console.error` leaks error details to browser console | Low | DashboardPage catches and logs full error objects |
| No rate limiting on non-auth POST endpoints | Low | Rate limiter only on auth routes |

---

## Integration Risks

| Integration | Status | Risk if down |
|-------------|--------|-------------|
| PostgreSQL | Required | **All features break** — API crashes on DB connection failure |
| OpenClaw | Optional webhook | No impact if down; just misses events |
| Hermes | Connector registry only | No impact if absent |
| External calendars (Google, etc.) | Not implemented | N/A |
| Object storage (files) | Not implemented | FileHub upload goes nowhere |

---

## Top Priorities

1. **Implement calendar/chat/files backends** — 3 pages hit stub endpoints, blocking real usage
2. **Add file storage layer** — FileHub upload needs actual storage (local disk or S3)
3. **Add Goals page UI** — CRUD API exists but no route
4. **Implement member invite** — Replace alert() with POST /companies/:id/members
5. **Add database indexes** — 0 indexes on foreign keys, will degrade at scale
6. **Add GitHub repo skill importer** — Parse per-directory SKILL.md files

---

## Unknowns / Blockers

- **Runtime correctness unverified**: This audit is based on reading code only. No container was running to test flows.
- **Database migration state**: Cannot confirm if `reports_to`, `skills`, `agent_skills` columns/tables exist in the running DB.
- **No load testing**: No benchmarks exist for API response times under concurrent load.
- **No E2E tests**: 27 Vitest tests exist but cover unit components, not end-to-end flows.
- **Missing .env files**: No `.env.example` or `.env` in the repo; all config relies on defaults or Docker Compose interpolation.
