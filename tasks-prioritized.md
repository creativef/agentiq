# Prioritized Tasks — AgentIQ Remediation

## P0 — Critical (fix immediately)

### 1. Fix DATABASE_URL password in docker-compose.yml
- **Severity:** Critical
- **Category:** Bug
- **Description:** DATABASE_URL has `***` as password instead of `postgres`. Every API call fails with authentication error.
- **Evidence:** Log output: `password authentication failed for user "postgres"` (code 28P01)
- **Affected files:** `docker-compose.yml:32`, `docker-compose.yml:45`
- **Recommended fix:** Replace `postgres:***` with `postgres:postgres` in both app and hermes-bridge service environment sections.
- **Validation:** `docker compose up -d app && docker compose logs app --tail=5` should show no auth errors.

### 2. Prevent API OOM crashes
- **Severity:** Critical
- **Category:** Bug
- **Description:** API server crashes with "Reached heap limit Allocation failed" in Docker. Default Node heap is too small for the workload (Drizzle + Hono + orchestrator + Vite dev server).
- **Evidence:** Logs: `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
- **Affected files:** `docker-compose.yml` (app service), `Dockerfile`
- **Recommended fix:** Add `NODE_OPTIONS: "--max-old-space-size=4096"` to app service environment in docker-compose.yml. Long-term: split API and Vite into separate services.
- **Validation:** `docker compose logs app --tail=10` should show no OOM errors after sustained usage.

### 3. Fix hermes-bridge container startup
- **Severity:** Critical
- **Category:** Bug
- **Description:** Container fails with `Cannot find module '/app/bash'` because the node:20-alpine entrypoint (`docker-entrypoint.sh`) prepends `node` to the command.
- **Evidence:** Logs: `Error: Cannot find module '/app/bash'`
- **Affected files:** `docker-compose.yml:56`
- **Recommended fix:** Change command to `["sh", "-c", "pnpm install && sh apps/api/src/cli/hermes-bridge-loop.sh"]` and explicitly add `entrypoint: []` to the hermes-bridge service.
- **Validation:** `docker compose logs hermes-bridge --tail=5` should show `[Hermes Bridge] Starting loop`.

### 4. Add auth middleware to /api/data route
- **Severity:** Critical
- **Category:** Security
- **Description:** `apps/api/src/routes/data.ts` has NO authMiddleware import or usage. All data queries (companies, agents, tasks, events) are accessible without authentication.
- **Evidence:** No `authMiddleware` anywhere in data.ts file.
- **Affected files:** `apps/api/src/routes/data.ts`
- **Recommended fix:** Add `data.use(authMiddleware)` before route definitions, following the pattern used in all other routers.
- **Validation:** `curl http://localhost:3000/api/data` without a token should return 401.

### 5. Replace default JWT_SECRET
- **Severity:** Critical
- **Category:** Security
- **Description:** `JWT_SECRET` defaults to `dev-secret-change-in-production`. With `NODE_ENV=development`, no guard prevents its use. Token value is trivially guessable.
- **Evidence:** `apps/api/src/middleware/auth.ts:8` — `process.env.JWT_SECRET || "dev-secret-change-in-production"`
- **Affected files:** `apps/api/src/middleware/auth.ts:8`, `docker-compose.yml`
- **Recommended fix:** Generate a real secret with `openssl rand -hex 32` and set `JWT_SECRET` in .env. Add `JWT_SECRET: ${JWT_SECRET}` to docker-compose.yml app service.
- **Validation:** Verify `docker compose down && docker compose up -d app` starts without JWT_SECRET fallback.

---

## P1 — High (fix within a week)

### 6. Add database indexes on foreign keys
- **Severity:** High
- **Category:** Performance
- **Description:** No indexes defined on any FK columns. Every JOIN involving companyId, projectId, agentId, userId requires a full table scan.
- **Evidence:** `apps/api/src/db/schema.ts` — no `.index()` calls on any column.
- **Affected files:** `apps/api/src/db/schema.ts`
- **Recommended fix:** Add `.index()` to companyId on: companies, projects, agents, tasks, events, connectors, goals, journalEntries, calendarEvents, chatMessages, files, llmProviders, companyBriefs. Add index on userId in companyMembers. Add index on agentId in agentSkills.
- **Validation:** Run `EXPLAIN ANALYZE` on a company-scoped task query before and after.

### 7. Fix audit_log missing table definition
- **Severity:** High
- **Category:** Bug
- **Description:** `auditMiddleware` inserts into `audit_log` table (defined inline in audit-log.ts) but this table is NOT in `schema.ts` and likely wasn't created by migrations.
- **Evidence:** Middleware defines table at `apps/api/src/middleware/audit-log.ts:11` but schema.ts has no export for it. First mutation after DB creation will throw.
- **Affected files:** `apps/api/src/middleware/audit-log.ts`, `apps/api/src/db/schema.ts`
- **Recommended fix:** Add `export const auditLog = pgTable("audit_log", {...})` to schema.ts and ensure migration includes it.
- **Validation:** `curl -X POST http://localhost:3000/api/companies -H "Cookie: token=..." -d '{"name":"test"}'` should not produce audit log errors.

### 8. Implement pagination for list endpoints
- **Severity:** High
- **Category:** Performance
- **Description:** All GET list endpoints return all rows (up to 500 max). No cursor or offset pagination.
- **Evidence:** `apps/api/src/routes/tasks.ts:37` — `.limit(Math.min(parseInt(c.req.query("limit") || "100"), 500))`
- **Affected files:** All route files with GET list endpoints (dashboard.ts, tasks.ts, agents.ts, files.ts, journal.ts, calendar.ts)
- **Recommended fix:** Support `?limit=N&offset=M` or cursor-based pagination. Default limit=50. Max limit=200 for all endpoints.
- **Validation:** Verify `?limit=10&offset=0` returns exactly 10 items.

### 9. Fix `executionRuns` scratchpad column discrepancy
- **Severity:** High
- **Category:** Bug
- **Description:** Hermes bridge constructs a rich payload including scratchpad from task entity, but executionRuns schema doesn't have a scratchpad field. The bridge relies on task.scratchpad in the POST body, not the DB.
- **Evidence:** `apps/api/src/cli/hermes-bridge.ts:40-61` — scratchpad comes from `taskRow[0].scratchpad`, not executionRuns.
- **Affected files:** `apps/api/src/cli/hermes-bridge.ts`, `apps/api/src/db/schema.ts:160-171`
- **Recommended fix:** Add `scratchpad` field to executionRuns schema if it should be persisted, or document that it's task-level only.
- **Validation:** Ensure execution runs with scratchpad data work end-to-end.

### 10. Add loading states to all page components
- **Severity:** High
- **Category:** UX
- **Description:** No loading indicators during data fetch. Pages render blank/empty until fetch completes.
- **Evidence:** All pages use `useState` + `useEffect` pattern without a loading state variable.
- **Affected files:** All page components in `apps/web/src/pages/`
- **Recommended fix:** Add `const [loading, setLoading] = useState(true)` to each page, show spinner/skeleton during fetch.
- **Validation:** Network throttling in DevTools should show loading state visible to user.

---

## P2 — Medium (fix within a month)

### 11. Separate API and Vite into distinct Docker services
- **Severity:** Medium
- **Category:** Performance
- **Description:** Single container runs both API (tsx) and Vite dev server via `&` in CMD. Vite is not needed in production and consumes memory.
- **Evidence:** `Dockerfile:18` — both processes in one CMD
- **Affected files:** `Dockerfile`, `docker-compose.yml`
- **Recommended fix:** Create separate `api` service (production: `node dist/server.js`) and `web` service (dev: `vite`). Use `Dockerfile.production` for API only.

### 12. Add error boundaries and empty states to frontend
- **Severity:** Medium
- **Category:** UX
- **Description:** No error boundaries on individual pages. No empty state messaging for lists.
- **Evidence:** Only App.tsx uses ErrorBoundary. No "Create your first..." prompts in any page.
- **Affected files:** All page components in `apps/web/src/pages/`
- **Recommended fix:** Add ErrorBoundary wrapper per page. Add empty state component with CTA when lists are empty.

### 13. Implement CSRF protection
- **Severity:** Medium
- **Category:** Security
- **Description:** Cookie-based auth relies on `sameSite: Strict` which is good but not comprehensive. No explicit CSRF token mechanism.
- **Evidence:** `apps/api/src/routes/auth.ts:81` — `setCookie(c, "token", token, { httpOnly: true, sameSite: "Strict", path: "/" })`
- **Affected files:** `apps/api/src/routes/auth.ts`, `apps/api/src/index.ts`
- **Recommended fix:** Add CSRF token via `hono/csrf` middleware or implement double-submit cookie pattern.

### 14. Encrypt API keys at rest
- **Severity:** Medium
- **Category:** Security
- **Description:** LLM provider API keys stored in plaintext in llmProviders table.
- **Evidence:** `apps/api/src/db/schema.ts:214` — `apiKey: text("api_key")`
- **Affected files:** `apps/api/src/db/schema.ts`, `apps/api/src/routes/llm.ts`
- **Recommended fix:** Encrypt API key with a server-side key before DB insert. Decrypt on read. Or use environment variables for keys.

### 15. Add file type validation for uploads
- **Severity:** Medium
- **Category:** Security
- **Description:** File uploads only check size (50MB). No extension whitelist or content-type verification.
- **Evidence:** `apps/api/src/routes/files.ts:72-76` — only size check
- **Affected files:** `apps/api/src/routes/files.ts`
- **Recommended fix:** Add extension whitelist (pdf, docx, txt, csv, png, jpg, etc.) and verify actual file content matches claimed type.

### 16. Fix silent skill assignment failures
- **Severity:** Medium
- **Category:** Reliability
- **Description:** Skill assignment loop silently catches and ignores errors.
- **Evidence:** `apps/api/src/routes/agents.ts:103-112` — `try { insert } catch { /* skip */ }`
- **Affected files:** `apps/api/src/routes/agents.ts`
- **Recommended fix:** Log the error at minimum, return partial success with list of successfully assigned skills vs. failed ones.

### 17. Add retryCount to execution flow
- **Severity:** Medium
- **Category:** Reliability
- **Description:** `retryCount` column exists on tasks schema but is never incremented or checked.
- **Evidence:** `apps/api/src/db/schema.ts:74` — defined but unused in code
- **Affected files:** `apps/api/src/db/schema.ts`, `apps/api/src/routes/tasks.ts`, `apps/api/src/execution/dispatcher.ts`
- **Recommended fix:** Increment retryCount on each re-dispatch. Reject dispatches after maxRetries (e.g., 3).

### 18. Replace keyword-matching task executor with LLM-based intent
- **Severity:** Medium
- **Category:** Tech Debt
- **Description:** `task-execution.ts` uses brittle keyword matching (`includes("hire")`) to determine what to do with a task.
- **Evidence:** `apps/api/src/task-execution.ts:64` — `if (fullText.includes("hire") ...)`
- **Affected files:** `apps/api/src/task-execution.ts`
- **Recommended fix:** Use the LLM provider layer to classify task intent before executing. Fall back to pattern matching only when LLM is unavailable.

---

## P3 — Low (backlog)

### 19. Remove dead code
- **Severity:** Low
- **Category:** Tech Debt
- **Description:** `task-exec.ts` marked DEPRECATED, duplicate `sql` imports in index.ts, multiple unused utility functions.
- **Evidence:** `apps/api/src/task-exec.ts:1` — "DEPRECATED" comment
- **Affected files:** `apps/api/src/task-exec.ts`, `apps/api/src/index.ts:37`
- **Recommended fix:** Delete task-exec.ts, remove duplicate import.

### 20. Separate API and frontend response formats
- **Severity:** Low
- **Category:** Tech Debt
- **Description:** Some routes return `{ agents: [...] }`, others `{ tasks: [...] }`, others `{ ok: true }`. Inconsistent response envelope.
- **Evidence:** dashboard.ts returns `{ companies: result }`, agents.ts returns `{ agents: result }`, projects.ts returns `{ ok: true }`
- **Affected files:** All route files
- **Recommended fix:** Standardize on `{ data: ..., error: null }` / `{ data: null, error: ... }` envelope.

### 21. Remove `version: "3.8"` from docker-compose.yml
- **Severity:** Low
- **Category:** Tech Debt
- **Description:** Docker Compose shows warning: "the attribute `version` is obsolete"
- **Evidence:** `docker-compose.yml:1`
- **Recommended fix:** Delete line 1.

### 22. Add pnpm install caching in Dockerfile
- **Severity:** Low
- **Category:** Performance
- **Description:** `pnpm install` runs on every container start due to CMD. Should be in the image build step.
- **Evidence:** `Dockerfile:12` — `RUN pnpm install --frozen-lockfile` is in build but `CMD` also runs it.
- **Affected files:** `Dockerfile:18`
- **Recommended fix:** Remove `CI=true pnpm install &&` from CMD. Dependencies are already installed in the image.

### 23. Add OpenAPI/Swagger documentation
- **Severity:** Low
- **Category:** Feature
- **Description:** No API documentation for the 20+ routes.
- **Evidence:** No OpenAPI spec or Swagger UI anywhere.
- **Recommended fix:** Add `@hono/zod-openapi` with Zod schemas from shared package.

### 24. Implement proper multi-company context switching
- **Severity:** Low
- **Category:** Feature
- **Description:** Users can belong to multiple companies, but queries return ALL company data. No "active company" selection in the UI.
- **Evidence:** `AuthContext.tsx` fetches companies but doesn't set an active context.
- **Affected files:** `apps/web/src/contexts/AuthContext.tsx`, `apps/web/src/layouts/DashboardLayout.tsx`
- **Recommended fix:** Add activeCompany state to AuthContext. Filter all queries by activeCompany.
