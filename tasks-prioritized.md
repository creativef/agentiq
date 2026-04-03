# Mission Control — Prioritized Remediation Tasks

**Date:** 2026-04-02
**Source:** audit-report.md
**Total tasks:** 20

---

## CRITICAL (Blocks core functionality)

### T-01 | Mount 5 unreachable API routes
- **Severity:** Critical
- **Category:** Bug
- **Description:** calendar, chat, files, journal, realtime are imported in index.ts but never passed to `app.route()`. Frontend pages make API calls that return 404.
- **Evidence:** `apps/api/src/index.ts` lines 8-12 (imports) but lines 27-30 only mount auth, dashboard, agentsRouter, tasksRouter.
- **Affected files:** `apps/api/src/index.ts`
- **Recommended fix:** Add `app.route("/api", calendar)`, `app.route("/api", chat)`, `app.route("/api", files)`, `app.route("/api", journal)`, `app.route("/api", realtime)` after the existing mounts.
- **Validation:** `curl http://localhost:3000/api/chat` should return `{"ok":true}` instead of `{"error":"Not Found"}`.

### T-02 | Fix CalendarMeetings endpoint mismatch
- **Severity:** Critical
- **Category:** Bug
- **Description:** Frontend calls `GET /api/calendar` (line 10 of CalendarMeetings.tsx) but backend defines `POST /meetings` (calendar.ts line 5). Even if mounted, wrong method + wrong path.
- **Evidence:** `apps/web/src/pages/CalendarMeetings.tsx` line 10: `fetch("/api/calendar")`; `apps/api/src/routes/calendar.ts` line 5: `calendar.post("/meetings", ...)`.
- **Affected files:** `apps/api/src/routes/calendar.ts`, `apps/web/src/pages/CalendarMeetings.tsx`
- **Recommended fix:** Add `GET /calendar` endpoint in calendar.ts that returns events. Either create a calendar_events DB table or reuse existing events table filtered by type.
- **Validation:** Calendar page loads events on mount without 404.

---

## HIGH (Data integrity, misleading UX, missing authz)

### T-03 | Add input validation to all POST endpoints
- **Severity:** High
- **Category:** Security / Reliability
- **Description:** Zero Zod/schema validation on any request body. Invalid/null payloads reach Drizzle directly.
- **Evidence:** grep for "zod" in apps/api returns 0 results. All POST handlers use `await c.req.json()` → direct `db.insert(values)`.
- **Affected files:** `apps/api/src/routes/auth.ts`, `route/agents.ts`, `routes/tasks.ts`, `routes/dashboard.ts`, `routes/openclaw.ts`
- **Recommended fix:** Install zod. Create validation schemas per route. Add `schema.parse(body)` or validation middleware before DB calls. Return 400 with field-level errors.
- **Validation:** `curl -X POST /api/auth/register -H "Content-Type: application/json" -d '{}'` returns 400, not 500.

### T-04 | Fix CompanySettings save button (fake success)
- **Severity:** High
- **Category:** Bug / UX
- **Description:** Clicking "Save Changes" shows a green "Settings saved!" toast but no API call is made. `handleSave` only calls `e.preventDefault()` and sets state. Comment reads `// PUT /api/companies/:id would go here`.
- **Evidence:** `apps/web/src/pages/CompanySettings.tsx` lines 25-27.
- **Affected files:** `apps/web/src/pages/CompanySettings.tsx`, `apps/api/src/routes/dashboard.ts` (need PUT endpoint)
- **Recommended fix:** Add `PUT /companies/:id` backend endpoint. Frontend sends `{name, goal}` on submit and handles errors.
- **Validation:** Change company goal, save, reload page — goal should persist.

### T-05 | Fix CompanySettings member list bug
- **Severity:** High
- **Category:** Bug
- **Description:** `setMembers(companies || [])` populates the "Owners & Founders" list with company objects, not user/member records. Displays company names instead of people.
- **Evidence:** `apps/web/src/pages/CompanySettings.tsx` line 23. `companyMembers` table exists in DB with userId, roleId, companyId but is never queried for display.
- **Affected files:** `apps/web/src/pages/CompanySettings.tsx`
- **Recommended fix:** Add `GET /companies/:id/members` endpoint that joins companyMembers → users. Frontend uses this for the member list.
- **Validation:** Company Settings shows user emails and roles, not company names.

### T-06 | Implement Calendar save functionality
- **Severity:** High
- **Category:** Missing Feature
- **Description:** Calendar event form has `onSubmit={e => e.preventDefault()}` — does nothing. No calendar_events table exists.
- **Evidence:** `apps/web/src/pages/CalendarMeetings.tsx` line 47.
- **Affected files:** `apps/api/src/routes/calendar.ts`, `apps/web/src/pages/CalendarMeetings.tsx`, `apps/api/src/db/migrate.ts` (need new table)
- **Recommended fix:** Create `calendar_events` table (id, companyId, title, date, time, agenda). Add GET /calendar and POST /calendar endpoints. Wire form to POST.
- **Validation:** Create event, see it on calendar, persists after refresh.

### T-07 | Implement Chat backend
- **Severity:** High
- **Category:** Missing Feature
- **Description:** ChatJournal frontend has full UI (message list, input, send). Backend: `POST /chat → {ok: true}`, no GET. No messages table.
- **Evidence:** `apps/api/src/routes/chat.ts` line 5; `apps/web/src/pages/ChatJournal.tsx` lines 36-43 (POST expects response with id).
- **Affected files:** `apps/api/src/routes/chat.ts`, need `chat_messages` table
- **Recommended fix:** Create `chat_messages` table (id, companyId, userId, role, content, createdAt). Add GET /messages and POST /chat. Wire to company context.
- **Validation:** Send message, it appears in chat list, persists.

### T-08 | Implement Journal backend
- **Severity:** High
- **Category:** Missing Feature
- **Description:** Similar to chat. GET /journal returns `{ok: true}`, POST /journal not defined. No journal_entries table.
- **Evidence:** `apps/api/src/routes/journal.ts` line 5; `apps/web/src/pages/ChatJournal.tsx` lines 48-56.
- **Affected files:** `apps/api/src/routes/journal.ts`, DB migration needed
- **Recommended fix:** Create `journal_entries` table. Add GET /journal and POST /journal endpoints. Filter by company.
- **Validation:** Create journal entry, see it listed, persists.

### T-09 | Implement Files backend
- **Severity:** High
- **Category:** Missing Feature
- **Description:** FileHub frontend has upload UI, file list, size formatting. Backend: `POST /files → {ok: true}`. No file storage, no GET /files.
- **Evidence:** `apps/api/src/routes/files.ts` line 5; `apps/web/src/pages/FileHub.tsx` lines 26-35 (upload + list).
- **Affected files:** `apps/api/src/routes/files.ts`, DB migration needed, file storage layer needed
- **Recommended fix:** Decide on storage strategy (local disk vs S3). Create `files` metadata table. Implement GET /files (list) and POST /files (upload with multipart). Add company scoping.
- **Validation:** Upload file, see it in list, download works.

---

## MEDIUM (Reliability, performance, error handling)

### T-10 | Add database indexes on foreign keys
- **Severity:** Medium
- **Category:** Performance
- **Description:** No indexes on company_id, project_id, user_id foreign keys. All filtered queries full-scan.
- **Evidence:** `apps/api/src/db/schema.ts` — no `index()` calls. `db/migrate.ts` — only CREATE TABLE, no CREATE INDEX.
- **Affected files:** `apps/api/src/db/migrate.ts`, `apps/api/src/db/schema.ts`
- **Recommended fix:** Add indexes: `agents(company_id)`, `tasks(project_id, agent_id)`, `events(company_id, project_id)`, `company_members(user_id, company_id)`, `projects(company_id)`, `goals(company_id)`.
- **Dependencies:** None
- **Validation:** `EXPLAIN ANALYZE` on common queries shows index scans, not sequential scans.

### T-11 | Add error banners for API failures
- **Severity:** Medium
- **Category:** UX / Reliability
- **Description:** DashboardPage, AgentsPage, CalendarMeetings all use `.catch(console.error)` or `.catch(() => {})`. Users see empty pages with no indication of failure.
- **Evidence:** `apps/web/src/pages/DashboardPage.tsx` line 35; `CalendarMeetings.tsx` line 12.
- **Affected files:** All page files in `apps/web/src/pages/`
- **Recommended fix:** Add `error` state to each component. Show retry banner on failure. Implement exponential backoff for transient errors.
- **Validation:** Kill API server, reload page — shows "Connection failed. Retry?" banner.

### T-12 | Add password strength and email validation
- **Severity:** Medium
- **Category:** Security
- **Description:** Accepts any string for email (no `@` required) and any length password (even empty string).
- **Evidence:** `apps/api/src/routes/auth.ts` line 16 — destructures email/password with no validation.
- **Affected files:** `apps/api/src/routes/auth.ts`, `apps/web/src/pages/Login.tsx`
- **Recommended fix:** Backend: zod schema with `z.string().email()` and `z.string().min(8)`. Frontend: real-time validation feedback.
- **Validation:** `curl -X POST /api/auth/register -d '{"email":"notanemail","password":"x"}'` returns 400.

### T-13 | Add company context to Calendar and Chat pages
- **Severity:** Medium
- **Category:** Reliability
- **Description:** CalendarMeetings and ChatJournal do not use `useAuth()`. No companyId filtering. If the backend were implemented, data would be unscoped.
- **Evidence:** Neither file imports `useAuth` from `../contexts/AuthContext`.
- **Affected files:** `apps/web/src/pages/CalendarMeetings.tsx`, `apps/web/src/pages/ChatJournal.tsx`
- **Recommended fix:** Import `useAuth`, guard fetch with `if (!company) return`, pass companyId to API calls.
- **Validation:** API requests include companyId, responses are company-filtered.

### T-14 | Add pagination to heavy list endpoints
- **Severity:** Medium
- **Category:** Performance
- **Description:** Dashboard events: `LIMIT 50` hardcoded. No offset or cursor. At scale, returns all matching rows.
- **Evidence:** `apps/api/src/routes/dashboard.ts` line 66.
- **Affected files:** `apps/api/src/routes/dashboard.ts`, `apps/api/src/routes/agents.ts`
- **Recommended fix:** Accept `?limit=20&offset=0` query params. Return `{data, hasMore}`. Frontend: infinite scroll or pagination controls.
- **Validation:** Requesting `?limit=5` returns exactly 5 items.

### T-15 | Fix TaskBoard dead-code filter
- **Severity:** Medium
- **Category:** Reliability
- **Description:** `tasks.filter((t) => !company || true)` is always true. Dead code that could mask logic errors if changed.
- **Evidence:** `apps/web/src/pages/TaskBoard.tsx` line 41.
- **Affected files:** `apps/web/src/pages/TaskBoard.tsx`
- **Recommended fix:** Remove the filter (backend already filters) or replace with actual company filtering if backend changes.

---

## LOW (Tech debt, polish)

### T-16 | Remove orphaned/unused components
- **Severity:** Low
- **Category:** Tech Debt
- **Description:** 7 components imported but never rendered: Sidebar.tsx, TopBar.tsx, KpiTiles.tsx, StatusWall.tsx, OpsTimeline.tsx, QuickActions.tsx, CompanyPanel.tsx. Sidebar.tsx duplicates DashboardLayout's sidebar. KpiTiles/StatusWall contain hardcoded mock data.
- **Evidence:** grep for these component names in App.tsx returns 0 import matches.
- **Affected files:** `apps/web/src/components/Sidebar.tsx`, `TopBar.tsx`, `Overview/KpiTiles.tsx`, `Overview/StatusWall.tsx`, `Overview/OpsTimeline.tsx`, `Overview/QuickActions.tsx`, `Overview/CompanyPanel.tsx`
- **Recommended fix:** Delete unused files. If needed later, convert them to use real data from dashboard API.
- **Validation:** `pnpm build` succeeds. No import errors.

### T-17 | Remove react-router-dom duplicate dependency
- **Severity:** Low
- **Category:** Tech Debt
- **Description:** Both react-router and react-router-dom v7 installed. v7 merged them — only react-router needed.
- **Evidence:** `apps/web/package.json` lines 12-13.
- **Affected files:** `apps/web/package.json`
- **Recommended fix:** `pnpm remove react-router-dom -C apps/web`. Verify imports still resolve.
- **Validation:** `pnpm build` succeeds. No missing import errors.

### T-18 | Add calendar month navigation arrow fix
- **Severity:** Low
- **Category:** UX
- **Description:** Calendar navigation uses `{"<<"}` and `{">>"}` which may render as literal braces depending on JSX parsing.
- **Evidence:** `apps/web/src/pages/CalendarMeetings.tsx` lines 55-56.
- **Affected files:** `apps/web/src/pages/CalendarMeetings.tsx`
- **Recommended fix:** Use `&lt;&lt;` and `&gt;&gt;` HTML entities, or simply the Unicode characters `‹` and `›`.

### T-19 | Fix FileHub upload error handling
- **Severity:** Low
- **Category:** Reliability
- **Description:** `handleUpload` does not check `res.ok`. Upload silently appears to succeed even on 500 errors.
- **Evidence:** `apps/web/src/pages/FileHub.tsx` lines 31-35.
- **Affected files:** `apps/web/src/pages/FileHub.tsx`
- **Recommended fix:** Add error state, show error message on upload failure, prevent page reload on failure.

### T-20 | Implement Goals API routes
- **Severity:** Low
- **Category:** Missing Feature
- **Description:** goals table exists in DB with title, description, progress, parentId. No API routes expose it. Dashboard tries to compute goalProgress from it.
- **Evidence:** `apps/api/src/db/schema.ts` lines 67-75 (goals table). No route imports goals.
- **Affected files:** Need new `routes/goals.ts`, mount in index.ts
- **Recommended fix:** Create CRUD endpoints for goals scoped to companyId. Wire to Company Settings or Dashboard.
