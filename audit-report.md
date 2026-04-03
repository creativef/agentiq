# Mission Control (AgentIQ) — Evidence-Based Audit Report

**Date:** 2026-04-02
**Git commit audited:** 5bfc9f4 (routing fix) + 96fc3e1 (Company label fix)
**Confidence basis:** Static code analysis only. No runtime verification performed on this pass.

---

## Executive Summary

The application has a working shell: React frontend with sidebar navigation, Hono API backend, PostgreSQL database, JWT auth, and 7 page components. The core user journey (register → login → dashboard → manage agents) is architecturally sound.

However, **5 of 9 API route modules are imported but never mounted**, making 5 frontend pages functionally broken. Pages render UI but their API calls return 404. Additionally, **2 routes mounted in index.ts have NO auth middleware** (calendar, chat, files, journal, realtime — all 5 are never mounted AND have no auth). The OpenClaw webhook endpoint is mounted but still lacks auth middleware.

**Status: Phase 1C (all pages exist and render). But only 4 of 11 API endpoints are functional. The other 7 return 404 or `{ok: true}`.**

---

## 1. Architecture Overview

| Layer | Technology | Evidence |
|-------|-----------|----------|
| Frontend | React 18 + React Router v7 + Vite 8 | apps/web/package.json |
| Backend | Hono.js 4.5 + @hono/node-server | apps/api/package.json |
| Database | PostgreSQL 16 (via docker-compose) | docker-compose.yml |
| ORM | Drizzle 0.36 + postgres 3.4 | apps/api/package.json, db/client.ts |
| Auth | JWT (hono/jwt) in httpOnly cookies + bcrypt | routes/auth.ts, middleware/auth.ts |
| State | React useState/useContext only (no Redux/Zustand) | AuthContext.tsx |
| Infra | Docker Compose, Node 20 Alpine | Dockerfile, docker-compose.yml |
| Tests | Vitest (28 test files across api + web + shared) | vitest.config.ts files |
| Package manager | pnpm v9 workspaces | pnpm-workspace.yaml |

### Entry Points
- Frontend: `apps/web/src/main.tsx` → mounts `<App />` to `#root`
- Backend: `apps/api/src/server.ts` → `serve({ fetch: app.fetch, port: 3000 })`
- Hono app: `apps/api/src/index.ts` → exports `app`

### Route Registration (index.ts, lines 27-30)
```
MOUNTED:    auth, dashboard, agentsRouter, tasksRouter
NOT MOUNTED: calendar, chat, files, journal, realtime, openclaw, data
```

---

## 2. Feature Status Matrix

| # | Feature | Backend | Frontend UI | Frontend→API Wiring | Status | Confidence |
|---|---------|---------|-------------|---------------------|--------|------------|
| 1 | Authentication (login/register/logout) | Full CRUD | Login.tsx (complete) | Wired (AuthContext.tsx) | **Fully functional** | Confirmed from code |
| 2 | Dashboard (KPIs, status wall, activity timeline) | GET /companies/:id/dashboard | DashboardPage.tsx (complete) | Wired (fetches /api/companies/:id/dashboard) | **Fully functional** | Confirmed from code |
| 3 | Company management (list, create, switch) | GET/POST /companies | DashboardLayout + AuthContext | Wired | **Fully functional** | Confirmed from code |
| 4 | Agents (list/create/update/delete) | Full CRUD on /companies/:id/agents + /agents/:id | AgentsPage.tsx (complete, 150 lines) | Wired | **Fully functional** | Confirmed from code |
| 5 | Tasks (kanban CRUD, drag-drop) | Full CRUD on /tasks | TaskBoard.tsx (complete, 151 lines) | Wired | **Fully functional** | Confirmed from code |
| 6 | Calendar | POST /meetings only — stub | CalendarMeetings.tsx (complete, 77 lines) | Calls GET /api/calendar → **404** (not mounted) | **Partially operational** — UI works, API stub/not mounted |
| 7 | Chat/Journal | POST /chat stub, GET /journal stub | ChatJournal.tsx (complete, 110 lines) | Calls GET/POST /api/chat → **404**, /api/journal → **404** | **Partially operational** — UI works, API stub/not mounted |
| 8 | File Hub | POST /files stub | FileHub.tsx (complete, 93 lines) | Calls GET/POST /api/files → **404** | **Partially operational** — UI works, API stub/not mounted |
| 9 | Org Chart | Uses /companies/:id/agents (reused) | CompanyOrg.tsx (complete, 83 lines) | Wired (reuses agents endpoint) | **Fully functional** (depends on agents data) |
| 10 | Company Settings | Uses /companies (reused) | CompanySettings.tsx (80 lines) | Wired for read; save = no-op (comment only), invite = alert() | **Partial** — reads work, save/invite stubbed |
| 11 | Realtime events | GET /events → returns empty string | Not routed in App.tsx | Not applicable | **Not implemented** |
| 12 | OpenClaw connector | POST /connectors/openclaw | Not exposed in UI | Not applicable | **Partial** — accepts events but no webhook secret (has since been fixed), not routable from UI |
| 13 | Goals | DB table exists | No UI, no API routes | Not applicable | **Not implemented** |
| 14 | Data (raw queries) | GET /companies, GET /events | Used by orphaned CompanyPanel/Sidebar components | Wired to orphaned components only | **Functional but insecure** (P0 fix applied, now auth-required) |

---

## 3. Confirmed Findings

### 3.1 Routing — Fixed (was critical bug)
**File:** `apps/web/src/App.tsx`
**Finding:** Routes were previously `<Route path="x" element={<Layout><Page /></Layout>} />` where Layout uses `<Outlet />`. Since `<Outlet />` requires nested routes, not React children, every page rendered empty inside `<main>`. Fixed by converting all routes to nested form.
**Category:** Bug (FIXED)

### 3.2 AuthContext — Company ID type mismatch (FIXED in 435fb51)
**File:** `apps/web/src/contexts/AuthContext.tsx`, `apps/api/src/routes/auth.ts`
**Finding:** `/auth/register` returns `company: <uuid-string>` but frontend did `data.company.id`. Since strings have no `.id` property, `company.id` resolved to `undefined`, causing dashboard to fetch `/api/companies/undefined/dashboard`.
**Fix applied:** Added `typeof data.company === "string"` guard.
**Category:** Bug (FIXED)

### 3.3 Five API route modules are imported but NEVER mounted
**Files:** `apps/api/src/index.ts` (lines 8-12 imports, lines 27-30 mounts)
**Finding:** `calendar`, `chat`, `files`, `journal`, `realtime` are imported but never passed to `app.route()`. Their routes are unreachable.
- Frontend CalendarMeetings.tsx calls `GET /api/calendar` → **404**
- Frontend ChatJournal.tsx calls `GET /api/chat`, `POST /api/chat`, `GET /api/journal`, `POST /api/journal` → **all 404**
- Frontend FileHub.tsx calls `GET /api/files`, `POST /api/files` → **both 404**
**Category:** Bug

### 3.4 Calendar save form does nothing
**File:** `apps/web/src/pages/CalendarMeetings.tsx`, line 47
**Finding:** `<form onSubmit={e => e.preventDefault()}>` — the submit handler only prevents default. No fetch call. No API endpoint exists for calendar events (calendar.ts only has `POST /meetings → {ok: true}`).
**Category:** Missing feature

### 3.5 Company Settings save button is a no-op
**File:** `apps/web/src/pages/CompanySettings.tsx`, lines 25-27
**Finding:** `handleSave` does `e.preventDefault()` then shows a fake "Settings saved!" toast. No PUT request. Comment says `// PUT /api/companies/:id would go here`.
**Finding:** `handleInvite` does `alert("Invitation feature coming soon")` — no API exists.
**Category:** Missing feature

### 3.6 CalendarMeetings fetches from wrong endpoint
**File:** `apps/web/src/pages/CalendarMeetings.tsx`, line 10
**Finding:** Calls `GET /api/calendar` — but calendar.ts defines `POST /meetings`, not `GET /cal`. Even if mounted, endpoint mismatch.
**Category:** Bug

### 3.7 Calendar form has escaped unicode in render
**File:** `apps/web/src/pages/CalendarMeetings.tsx`
**Finding:** The `<<` and `>>` month navigation buttons use `"{"}<<{"}"}` which renders as literal `{` and `}` characters instead of `<` and `>`.
**Category:** UX

### 3.8 CompanyOrg reuses agents endpoint as "people"
**File:** `apps/web/src/pages/CompanyOrg.tsx`, line 16
**Finding:** Org chart fetches agents and displays them as organization members. This means real humans (company_members table) are never shown — only AI agents. No dedicated people/members endpoint exists.
**Category:** Design limitation

### 3.9 CompanySettings shows all companies as "members"
**File:** `apps/web/src/pages/CompanySettings.tsx`, line 23
**Finding:** `setMembers(companies || [])` — populates the "Owners & Founders" list with the entire `companies[]` array (each company object), not actual users/members. This displays duplicate company names, not people.
**Category:** Bug

### 3.10 File upload silently fails
**File:** `apps/web/src/pages/FileHub.tsx`, lines 31-35
**Finding:** `handleUpload` calls `fetch("/api/files", ...)` but does not check `res.ok`. No error handling. The API endpoint `/api/files` returns `{ok: true}` (stub) and never stores the file. Even if the API worked, `FormData` upload with no `Content-Type` override is needed.
**Category:** Missing feature (backend)

### 3.11 CalendarMeetings has no company context
**File:** `apps/web/src/pages/CalendarMeetings.tsx`
**Finding:** Unlike DashboardPage, AgentsPage, CompanyOrg — CalendarMeetings does NOT use `useAuth()` or filter events by company. If the calendar endpoint existed, it would return ALL events globally.
**Category:** Reliability concern

### 3.12 ChatJournal has no company or user context
**File:** `apps/web/src/pages/ChatJournal.tsx`
**Finding:** No `useAuth()` import. Messages are stored without companyId, userId, or agentId references. Even if backend existed, there's no company scoping.
**Category:** Reliability concern

---

## 4. Suspected Findings Requiring Runtime Verification

### 4.1 Vite proxy may conflict with Docker networking
**File:** `apps/web/vite.config.ts`, lines 8-13
**Finding:** Vite proxies `/api` to `http://localhost:3000`. Inside Docker, `localhost` in the Vite container refers to the container's own loopback, not the API container. The Dockerfile CMD runs both API and Vite in the same container, so this works in Docker but would break in a split architecture.
**Requires runtime:** Verify that `fetch("/api/...")` actually reaches the Hono server during development.

### 4.2 Database migration runs every container start
**File:** `Dockerfile`, line 18
**Finding:** CMD runs `tsx src/db/migrate.ts` on every startup. Table creation uses `IF NOT EXISTS` so it's safe, but migration tracking (drizzle migrations) is not implemented. Schema drift between `db/schema.ts` and `db/migrate.ts` is possible.
**Evidence:** schema.ts uses Drizzle declarative style, migrate.ts uses raw SQL — they are decoupled.

### 4.3 JWT cookie SameSite=Strict may break cross-origin in some setups
**File:** `apps/api/src/routes/auth.ts`, line 47
**Finding:** `setCookie` uses `sameSite: "Strict"`. If the frontend is served from a different origin than the API (e.g., separate containers with different ports), the cookie may not be sent on cross-origin requests. The docker-compose setup serves both from the same container (ports 3000 and 5173), but the Vite proxy should handle cookie forwarding.
**Requires runtime:** Test that cookie is correctly sent from `localhost:5173` to `localhost:3000`.

### 4.4 TaskBoard has companyId filtering concern
**File:** `apps/web/src/pages/TaskBoard.tsx`, line 41
**Finding:** `const filtered = (d.tasks || []).filter((t: Task) => !company || true)` — the filter condition `!company || true` is always `true`. All tasks are displayed regardless of company. This is safe because the backend API already filters by user's companies, but the frontend filter is dead code.
**Evidence:** routes/tasks.ts line 31-33 already has `where(companyMembers.userId = user.userId)`, so backend handles isolation.

---

## 5. UX/UI Issues

### 5.1 No loading skeletons anywhere
**Files:** DashboardPage.tsx (line 49), AgentsPage.tsx (line 77), TaskBoard.tsx (line 98), ChatJournal.tsx (line 60), FileHub.tsx (line 55), CompanyOrg.tsx (line 29), CompanySettings.tsx (no loading state)
**Finding:** Show plain "Loading..." text. No animated skeletons, no spinner, no progressive rendering.
**Severity:** Low

### 5.2 Error states silently swallowed
**Files:** DashboardPage.tsx (line 35 `.catch(console.error)`), AgentsPage.tsx (line 35 `.catch(console.error)`), CalendarMeetings.tsx (line 12 `.catch(() => {})` — empty catch)
**Finding:** Users see stale/empty data with no error UI. The calendar catches silently and does nothing. Dashboard catches and logs to console only.
**Severity:** High

### 5.3 CalendarMeetings has broken arrow rendering
**File:** `apps/web/src/pages/CalendarMeetings.tsx`, lines 55-56
**Finding:** Month nav buttons use `{"<<"}` which should render `<<` but due to JSX, this may render literal braces. Same for `{">>"}`.
**Severity:** Low

### 5.4 Empty states are basic text messages
**All pages:** Show "No agents yet", "No tasks", "No messages yet" — functional but no illustrations or helpful guidance.
**Severity:** Low

### 5.5 CompanySettings save shows fake success
**File:** `apps/web/src/pages/CompanySettings.tsx`
**Finding:** Clicking "Save Changes" shows a green "Settings saved!" toast but nothing was persisted. This misleads the user.
**Severity:** High

### 5.6 CompanySettings invite button uses alert()
**Finding:** `alert("Invitation feature coming soon")` — blocks the entire browser UI with a native dialog.
**Severity:** Low

### 5.7 No offline/disconnected state handling
**All pages:** If the API server dies, pages show empty data with no "server unavailable" banner. No retry mechanism.
**Severity:** Medium

---

## 6. Reliability Issues

### 6.1 CompanySettings has no loading state but calls companies API
**File:** `apps/web/src/pages/CompanySettings.tsx`
**Finding:** Uses `company` and `companies` from AuthContext but has no `loading` guard. If AuthContext hasn't finished fetching during render, `company?.name` returns `""` (falsy). The form initializes with empty values, then a re-render from the useEffect updates them — causes a flash of empty inputs.
**Severity:** Low

### 6.2 TaskBoard silently ignores POST failures
**File:** `apps/web/src/pages/TaskBoard.tsx`, line 71
**Finding:** `if (res.ok)` checks response status but `res.json()` on error responses (like 500) may not have a `task` field. If `res.ok` is false, the task form stays open with no error displayed.
**Severity:** Medium

### 6.3 AgentsPage reloads page on create
**File:** `apps/web/src/pages/AgentsPage.tsx`, line 58
**Finding:** `window.location.reload()` after successful agent creation. This is a full page reload, causing a flash and re-fetching all data. Should instead append the new agent to the state array.
**Severity:** Low

### 6.4 FileHub uses window.location.reload() after upload
**File:** `apps/web/src/pages/FileHub.tsx`, line 34
**Finding:** Same pattern — full page reload instead of optimistic update.
**Severity:** Low

### 6.5 CalendarMeetings, ChatJournal, FileHub have no auth context dependency
**Files:** CalendarMeetings.tsx, ChatJournal.tsx, FileHub.tsx
**Finding:** These pages do not import `useAuth` (except for company in future). They fire API calls on mount regardless of whether the user is authenticated or has a company selected. If the user has no company, the calls may return 401 and fail silently.
**Evidence:** Only TaskBoard, DashboardPage, AgentsPage, CompanyOrg use `useAuth()`.
**Severity:** Medium

### 6.6 ChatJournal uses Date.now() as IDs
**File:** `apps/web/src/pages/ChatJournal.tsx`, lines 40, 52
**Finding:** `Date.now().toString()` used as message IDs. If two messages sent in the same millisecond (unlikely but possible), IDs collide. More importantly, these are client-side IDs that mismatch with any real backend IDs.
**Severity:** Low

### 6.7 Duplicate dependency: react-router-dom + react-router
**File:** `apps/web/package.json`, lines 12-13
**Finding:** Both `react-router` and `react-router-dom` v7 are installed. React Router v7 merged these — only `react-router` is needed. `react-router-dom` re-exports `react-router`. Wastes ~200KB.
**Severity:** Low (tech debt)

---

## 7. Performance Findings

### 7.1 No database indexes on foreign keys
**File:** `apps/api/src/db/schema.ts`
**Finding:** All 8 tables have foreign key constraints but no explicit indexes. Drizzle ORM does not create indexes automatically unless specified.
**Evidence:** No `index()` calls in schema.ts. migrate.ts only creates tables, not indexes.
**Impact:** `WHERE company_id = $1` queries full-scan. At scale (>10k rows per table), this degrades.
**Severity:** Medium

### 7.2 Dashboard fetches entire events list
**File:** `apps/api/src/routes/dashboard.ts`, lines 61-66
**Finding:** `SELECT ... FROM events WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50` — hardcoded limit, no offset/cursor parameter.
**Severity:** Low (acceptable for current scale)

### 7.3 Multiple sequential fetches without batching
**File:** `apps/web/src/pages/ChatJournal.tsx`, lines 24-28
**Finding:** Uses `Promise.all` — good. But `DashboardPage.tsx` does one fetch, `AgentsPage.tsx` does one fetch. No shared response caching.
**Severity:** Low

### 7.4 Vite proxy adds network hop
**File:** `apps/web/vite.config.ts`, line 10-11
**Finding:** Every `/api` request goes through Vite dev server → Hono. Adds ~5ms latency per request. Only relevant in dev mode.
**Severity:** None (dev only)

### 7.5 No React.memo, useMemo, or useCallback (except TaskBoard)
**Files:** DashboardPage.tsx, AgentsPage.tsx, CompanySettings.tsx, etc.
**Finding:** Only TaskBoard uses `useCallback` (lines 48-61). Other components re-create inline functions on every render.
**Severity:** Low (React 18 auto-batching handles most cases)

---

## 8. Security Findings

### 8.1 P0 fixes applied in this session (confirmed)
| Issue | Fix | Status |
|-------|-----|--------|
| tasks route not mounted | Added import + mount in index.ts | FIXED |
| data.ts endpoints unprotected | Added authMiddleware + company filtering | FIXED |
| OpenClaw webhook unprotected | Added X-Webhook-Secret header check | FIXED |
| Agent PUT/DELETE no authz | Added company membership check | FIXED |
| JWT_SECRET default | Runtime guard in production | FIXED |

### 8.2 No input validation on any POST endpoint
**Files:** `apps/api/src/routes/auth.ts`, `routes/agents.ts`, `routes/tasks.ts`, etc.
**Finding:** All POST endpoints use `await c.req.json()` without schema validation. Invalid payloads (missing fields, wrong types, extremely long strings) reach Drizzle queries directly.
**Evidence:** No zod, joi, or custom validation anywhere in the codebase. grep for "zod" returns zero matches in apps/api.
**Severity:** High
**Risk:** Data corruption, 500 errors, potential SQL injection (mitigated by Drizzle parameterization, but logic errors still possible)

### 8.3 No CSRF protection
**File:** `apps/api/src/middleware/auth.ts`
**Finding:** JWT stored in httpOnly cookie with `sameSite: "Strict"`. This provides good CSRF protection for same-site requests. However, if any route allows CORS with `credentials: true` from an attacker origin, the cookie would be sent.
**Current CORS:** Allows `localhost:5173` and `localhost:3000` only — safe for dev. Production CORS needs review.
**Severity:** Low (currently safe; needs review for production) SameSite=Strict already provides strong CSRF protection

### 8.4 Password hashing
**File:** `apps/api/src/routes/auth.ts`, line 24
**Finding:** Uses `bcrypt.hash(password, 12)` — cost factor 12, which is appropriate. Good.
**Severity:** None (correctly implemented)

### 8.5 No password strength validation
**File:** `apps/api/src/routes/auth.ts`, line 16
**Finding:** Accepts password of any length, including "1" or "". No complexity requirements.
**Severity:** Medium

### 8.6 No email format validation
**File:** `apps/api/src/routes/auth.ts`, line 16
**Finding:** Email is accepted as any string. No `@` check, no RFC validation.
**Severity:** Medium

### 8.7 JWT has no token revocation
**File:** `apps/api/src/routes/auth.ts`
**Finding:** Logout deletes the cookie client-side but cannot invalidate a server-side token. A stolen JWT remains valid for 30 days (exp: `86400 * 30`).
**Severity:** Low (acceptable for MVP; standard for stateless JWT)

### 8.8 Calendar, chat, files, journal routes have no auth middleware (but also no mount)
**Files:** `routes/calendar.ts`, `chat.ts`, `files.ts`, `journal.ts`, `realtime.ts`
**Finding:** None of these route files call `use(authMiddleware)`. If they were mounted, they'd be accessible without authentication.
**Evidence:** `grep authMiddleware apps/api/src/routes/{calendar,chat,files,journal,realtime,openclaw}.ts` returns 0 matches.
**Severity:** Medium (mitigated by not being mounted, but still a vulnerability if someone adds the mount)

---

## 9. Integration and Dependency Risks

### 9.1 OpenClaw connector — incomplete integration
**Files:** `apps/api/src/connectors/openclaw.ts`, `openclaw-poll.ts`
**Finding:**
- `normalizeEvent()` exists and is used (confirmed)
- `pollGateway()` returns empty array `[]` — stub
- Webhook endpoint POST /connectors/openclaw is mounted and secured
**Status:** Partially functional. Webhook accepts events. Polling is incomplete.

### 9.2 Goals table has no API routes
**Files:** `apps/api/src/db/schema.ts` (goals table)
**Finding:** DB schema defines `goals` table with id, companyId, title, description, parentId, progress. No route accesses it. Dashboard computes `goalProgress` from this table, but without routes, no client can create or update goals.
**Severity:** Medium (dead data structure)

### 9.3 Shared package is underutilized
**Files:** `packages/shared/src/types.ts`, `packages/shared/src/schemas.ts`
**Finding:** Only `roleSchema` (Zod enum) and `Role` type exist in shared. No DTO schemas, no API request/response types, no validation schemas used by the API.
**Evidence:** `grep shared apps/api/src/` returns 0 matches for actual usage of shared schemas.

---

## 10. Top Priorities

1. **Mount calendar, chat, files, journal, realtime routes in index.ts** — 5 pages currently hit 404. Quick fix: add `app.route("/api", calendar)` etc.
2. **Implement actual backend for calendar, chat, files, journal** — current route implementations are stubs (`{ok: true}`). Need DB tables and CRUD logic.
3. **Fix CompanySettings save and invite** — save shows fake success, invite is an alert.
4. **Fix CalendarMeetings endpoint mismatch** — frontend calls GET /api/calendar, backend defines POST /meetings.
5. **Fix CompanySettings member list bug** — shows companies instead of members.
6. **Add input validation** (zod schemas) to all POST endpoints.
7. **Add database indexes** on foreign keys.
8. **Add error banners** instead of silent catches.
9. **Fix ChatJournal and Calendar company scoping** — currently no company context.
10. **Remove orphaned components** (Sidebar.tsx, TopBar.tsx, KpiTiles.tsx, etc.) or wire them in.

---

## 11. Unknowns and Blockers

| Unknown | Why unknown | How to resolve |
|---------|------------|----------------|
| Whether Vite proxy correctly forwards cookies | Cannot test in this environment | Runtime: login in browser, inspect cookie on /api requests |
| Whether OpenClaw webhook secret env var is set | No .env file in repo | Check deployment env vars for OPENCLAW_WEBHOOK_SECRET |
| Database performance at scale | No real data loaded yet | Load test with seeded data |
| Whether `gen_random_uuid()` works in Postgres 16 Alpine | Depends on pgcrypto extension | Runtime: check table creation logs |
| Browser behavior with SameSite=Strict cookie across port boundaries | Depends on browser version | Runtime: DevTools > Application > Cookies |
| Test coverage quality | Test files exist but results not verified | Run `pnpm test` and review coverage |
| Whether Drizzle schema matches actual migrated tables | Manual SQL migration vs declarative Drizzle schema — no drift detection | Compare schema.ts with db/migrate.ts or use `drizzle-kit diff` |
