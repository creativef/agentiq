# Prioritized Tasks

## Critical
### C-01: Implement real Calendar backend
- **Category:** Missing Feature
- **Problem:** GET /calendar always returns empty list. No DB table exists. POST /calendar/meetings returns {ok:true} — no data stored.
- **Evidence:** `apps/api/src/routes/calendar.ts` — no DB queries, just stubs. No calendar_events table in schema.
- **Root cause:** Never implemented beyond scaffold.
- **Recommended fix:** Create calendar_events table (id, companyId, title, startTime, endTime, participants, notes). Implement full CRUD with company scoping.
- **Validation:** Create event via API → fetch via GET → verify it appears in calendar UI.

### C-02: Implement real Chat backend
- **Category:** Missing Feature
- **Problem:** POST /chat returns {ok:true} with no storage. No GET endpoint exists. Messages disappear.
- **Evidence:** `apps/api/src/routes/chat.ts` — single POST handler returning {ok:true}.
- **Root cause:** Scaffold-only implementation.
- **Recommended fix:** Create chat_messages table. Add GET /chat (list) and POST /chat (create). Scope by companyId.
- **Validation:** Send message → fetch messages → verify persistence.

### C-03: Implement file storage for FileHub
- **Category:** Missing Feature
- **Problem:** FileHub upload calls POST /api/files which returns {ok:true}. Files go nowhere. No GET endpoint to list files.
- **Evidence:** `apps/api/src/routes/files.ts` — POST stub only. No files table in schema.
- **Root cause:** Scaffold-only, no storage layer.
- **Recommended fix:** Choose local disk or cloud storage. Create files metadata table. Implement multipart upload + GET list + download endpoints.
- **Validation:** Upload a file → verify on disk → list shows it → download returns correct content.

## High
### H-01: Add Goals page UI
- **Category:** Missing Feature
- **Problem:** Full CRUD API exists at routes/goals.ts but no frontend page or route. Users cannot interact with goals.
- **Evidence:** `apps/api/src/routes/goals.ts` verified working. `apps/web/src/App.tsx` — no /goals route. `apps/web/src/pages/` — no GoalsPage.tsx.
- **Recommended fix:** Create GoalsPage.tsx with list/create/edit/delete. Add route + nav item.
- **Validation:** Navigate to /goals → create goal → edit → verify persisted.

### H-02: Implement member invite flow
- **Category:** UX
- **Problem:** "Invite" button in Company Settings shows a browser alert(). No POST endpoint for adding members.
- **Evidence:** `CompanySettings.tsx` — `handleInvite: () => alert("Invitation feature coming soon")`.
- **Root cause:** Feature stubbed during initial scaffolding.
- **Recommended fix:** Add POST /companies/:id/members endpoint. Replace alert with email input + add button. Create companyMembers record.
- **Validation:** Add member → verify in members list → verify new user can log in.

### H-03: Add database indexes on foreign keys
- **Category:** Performance
- **Problem:** 0 indexes on foreign key columns (company_id, project_id, agent_id, etc.). All lookups will full-scan at scale.
- **Evidence:** `apps/api/src/db/schema.ts` — no index() calls. Migration creates tables only.
- **Root cause:** No indexes were ever added to the schema or migration.
- **Recommended fix:** Add indexes: agents(company_id), tasks(project_id, agent_id), events(company_id), company_members(user_id, company_id), projects(company_id), connector(company_id), agent_skills(agent_id, skill_id).
- **Validation:** Run EXPLAIN ANALYZE on common queries → verify index scans.

### H-04: Add error handling UI to DashboardPage
- **Category:** UX
- **Problem:** `catch(console.error)` silently swallows API failures. User sees stale/empty data with no indication something went wrong.
- **Evidence:** `DashboardPage.tsx` — `.catch(console.error)` on both fetches. No error state or user-facing message.
- **Recommended fix:** Add error state variable. Show retry banner on fetch failure. Implement exponential backoff for transient errors.
- **Validation:** Kill API server → reload page → verify "Connection failed" message with retry button.

## Medium
### M-01: Add calendar project scoping to fetch
- **Category:** Bug
- **Problem:** Calendar fetches `/api/calendar` without companyId. Returns empty list; would return ALL events if backend existed.
- **Evidence:** `CalendarMeetings.tsx` — `fetch("/api/calendar")` with no params. No company context.
- **Recommended fix:** Add company filter to request. Backend must company-scope the query.
- **Validation:** Create events for two companies → verify only current company's events appear.

### M-02: Implement GitHub repo skill importer
- **Category:** Missing Feature
- **Problem:** Skill parser only handles concatenated markdown with ## headings. GStack uses per-directory SKILL.md files (autoplan/SKILL.md, canary/SKILL.md). Parser returns 0 skills from GStack format.
- **Evidence:** `utils/skillParser.ts` — `parseSkillsMarkdown` uses `## heading` split pattern. GStack format is one file per skill.
- **Recommended fix:** Add fetch endpoint that downloads all SKILL.md files from a GitHub repo, parses each file individually, creates skill records.
- **Validation:** Import `github.com/garrytan/gstack` → verify 27 skills created with correct names and instructions.

### M-03: Add company scoping to Calendar/Chat API calls
- **Category:** Bug  
- **Problem:** CalendarMeetings.tsx and ChatJournal.tsx fetch without companyId. Even with working backends, they'd return unscoped data.
- **Evidence:** `CalendarMeetings.tsx` — `fetch("/api/calendar")`. `ChatJournal.tsx` — `fetch("/api/chat")`. Neither uses company context.
- **Recommended fix:** Pass companyId in query params. Backend endpoints must filter by company membership.
- **Validation:** Verify cross-company data isolation.

### M-04: Load skills library once at component mount
- **Category:** Performance
- **Problem:** `loadAvailableSkills()` calls `/api/skills` every time skill picker is opened. No caching.
- **Evidence:** `AgentsPage.tsx` — `loadAvailableSkills` invoked inside event handler, not useEffect.
- **Recommended fix:** Move to useEffect with empty dependency array. Store in state.
- **Validation:** Open/close skill picker multiple times → verify only one API call made.

## Low
### L-01: Add goals nav item and route
- **Category:** Tech Debt
- **Evidence:** goals API works but App.tsx has no /goals route. Add to nav array + Route + page.
- **Recommended fix:** ~2h effort to create basic CRUD page.
- **Validation:** /goals → list/create/edit/delete works.

### L-02: Replace window.location.reload() usage
- **Category:** Tech Debt
- **Evidence:** FileHub, CalendarCreate, and CompanyCreate all use `window.location.reload()`. Causes Jank.
- **Recommended fix:** Use optimistic updates or re-fetch on success.

### L-03: Remove dead code modules
- **Category:** Tech Debt
- **Evidence:** `rbac.ts` middleware never used. `OpsDashboard.tsx` never routed. `lib/api.ts` never imported. `KpiTiles.tsx`, `StatusWall.tsx`, `TopBar.tsx` are orphaned.
- **Recommended fix:** Audit and delete unused files.

### L-04: Create .env.example file
- **Category:** Reliability
- **Problem:** No .env.example in repo. New users must guess config variables.
- **Recommended fix:** Create `.env.example` with DATABASE_URL, JWT_SECRET (placeholder), OPENCLAW_WEBHOOK_SECRET (placeholder), NODE_ENV.
- **Validation:** Clone repo → copy .env.example → docker compose up → works without errors.

### L-05: Implement member invite API
- **Category:** Missing Feature
- **Problem:** Company Settings has "Invite" button but no POST endpoint.
- **Evidence:** `CompanySettings.tsx` — `handleInvite` is alert(). No POST /companies/:id/members route.
- **Recommended fix:** Add endpoint that creates companyMembers record with role="CEO" or "MANAGER".

## Quick Wins (order of execution)
1. L-04: Create .env.example (5min)
2. L-03: Delete dead code (15min)
3. H-01: Add Goals page UI (2h)
4. M-04: Cache skill library fetch (5min)
5. L-02: Replace window.location.reload() (30min)
6. H-04: Add error handling to DashboardPage (30min)
7. H-02: Member invite endpoint (30min)
8. M-01: Calendar company scoping (15min)
9. M-03: Chat/Calendar company scoping (15min)
10. H-03: Database indexes (30min)
11. C-01: Calendar backend (2h)
12. C-02: Chat backend (1h)
13. C-03: File storage (3h)
14. M-02: GitHub repo skill importer (2h)
15. L-01: Add Goals page (1h)

## Blockers
- **DB table state unverified**: Cannot confirm skills, agent_skills, reports_to columns exist in running DB
- **No runtime environment**: This server cannot run Docker; all verification must happen on user's Mac
- **No test coverage for critical paths**: No E2E tests, no API integration tests

## Foundation Fixes (unlock downstream)
- C-01, C-02, C-03: Once calendar/chat/files have real backends, the frontend pages become immediately useful
- H-03: Once indexes are added, all list queries will scale
- M-02: Once GitHub skill importer exists, importing GStack's 27 skills takes one API call
