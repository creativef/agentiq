# Mission Control v2 — Phase 1: Foundation

> **Date:** 2026-04-01
> **Goal:** Build a working, multi-company Mission Control web UI that the user can actually use daily.
> **Scope:** Auth, company CRUD, shell layout, core dashboard with live data, task board, chat/journal, file hub, calendar, and org chart.

---

## Current State Assessment

### What Exists (AgentIQ)
- **Monorepo:** `apps/api` (Hono + TS) + `apps/web` (React + Vite) + `packages/shared`
- **DB Schema:** companies, projects, agents, tasks, events tables via Drizzle
- **API Routes:** calendar, chat, files, journal, realtime, openclaw, data (all scaffolds)
- **Components:** Sidebar, TopBar, ThemeToggle, KpiTiles, StatusWall, OpsTimeline, QuickActions, CompanyPanel
- **Pages:** OpsDashboard, CompanyOrg, TaskBoard, ChatJournal, FileHub, CalendarMeetings
- **Middleware:** RBAC (not wired to auth yet)
- **Connector:** OpenClaw poller with normalization (openclaw-poll.ts, openclaw.ts)
- **Tests:** Comprehensive test strategy across packages

### What's Missing
- **Auth system:** Login, JWT/session management, RBAC enforcement
- **Router:** No react-router, pages aren't wired to navigation
- **Working shell:** Components exist but are placeholder shells, no real data flow
- **Company management CRUD:** Can list companies but not create/edit/switch/scope
- **DB queries in routes:** Routes exist but lack complete CRUD implementations
- **Real-time data:** SSE routes exist but aren't fully wired to frontend
- **README/Docs:** Minimal setup instructions
- **Deployment:** No Docker, no CI/CD

### What We Keep (AgentIQ's Moat)
- Clean monorepo architecture
- OpenClaw connector with normalization layer
- RBAC middleware ready to connect
- SSE/realtime infrastructure
- Calendar, journal, file hub pages (unusual for agent dashboards)
- Status wall visualization
- Comprehensive test patterns
- 14 existing design/implementation plans

---

## Architecture Decisions

### Auth
- JWT-based with httpOnly cookies for security
- Simple email+password login (can upgrade to OAuth later)
- JWT payload: { userId, companyId, role }
- RBAC middleware decodes JWT and checks role against company permissions
- Password hashing via bcrypt

### Routing
- React Router DOM v6 for client-side routing
- Route structure:
  - `/login` — Auth page
  - `/` — Defaults to dashboard for active company
  - `/:companyId/dashboard` — Overview (Status Wall, KPIs, Ops Timeline)
  - `/:companyId/agents` — Agent roster and heartbeat status
  - `/:companyId/org` — Org chart
  - `/:companyId/tasks` — Kanban board
  - `/:companyId/calendar` — Calendar and meetings
  - `/:companyId/files` — File hub
  - `/:companyId/chat` — Chat/journal
  - `/settings` — User settings, company management

### Styling
- Keep existing plain CSS structure (no Tailwind in current codebase)
- Add CSS variables for theme system (dark/light)
- Create a `themes/` directory with CSS variable sets
- Mobile-responsive with flex/grid, media queries

### Data Flow
```
User Action → React Component → API Call (fetch) → Hono Route → Drizzle Query → PostgreSQL → Response → Update UI
                                                                        ↓
                                                                   SSE Events (real-time updates)
                                                                        ↓
                                                        OpenClaw Poller (ingests agent activity)
```

### Database Schema Enhancements
Need to add:

```sql
-- Auth
users (id, email, password_hash, createdAt)
company_members (companyId, userId, role)  -- Replaces standalone RBAC

-- Existing (keep + enhance)
companies (id, name, createdAt, goal TEXT)  -- Add goal field
projects (id, companyId, name, createdAt, status TEXT)  -- Add status
agents (id, companyId, projectId, name, role, status, heartbeat_interval, last_heartbeat, cost_monthly, budget_limit)  
tasks (id, projectId, agentId, title, description, status, priority, createdAt)
events (id, companyId, projectId, agentId, type, payload JSONB, createdAt)

-- New
goals (id, companyId, title, description, progress, parentId, type, createdAt)  -- Goal alignment trees
-- Budget tracking could be derived from agent cost fields + event aggregation
```

---

## Phase 1 Task Breakdown

### Task 1: Auth System
**Files:**
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/db/migrate.ts`
- Modify: `apps/api/src/db/schema.ts` (add users, company_members)
- Create: `apps/web/src/pages/Login.tsx`
- Create: `apps/web/src/contexts/AuthContext.tsx`
- Create: `apps/web/src/lib/auth.ts`

**Steps:**
1. Add users and company_members tables to Drizzle schema
2. Write migration to create tables
3. Create `POST /api/auth/register` and `POST /api/auth/login` endpoints
4. JWT generation and verification utilities
5. Create httpOnly cookie-based session management
6. Wire RBAC middleware to decode JWT and check role
7. Build Login page with email/password form
8. Create AuthContext provider for React
9. Add ProtectedRoute wrapper that redirects to /login if unauthenticated
10. Wire all existing API calls to include auth cookie/headers

### Task 2: Router + Shell Layout
**Files:**
- Modify: `apps/web/src/App.tsx` (complete rewrite with routing)
- Create: `apps/web/src/layouts/DashboardLayout.tsx`
- Create: `apps/web/src/components/Sidebar.tsx` (enhanced)
- Create: `apps/web/src/components/TopBar.tsx` (enhanced)
- Create: `apps/web/src/components/CompanySwitcher.tsx`

**Steps:**
1. Add react-router-dom to package.json
2. Build App shell with BrowserRouter
3. Create DashboardLayout with:
   - Sidebar (company tree + agents + navigation)
   - Top bar (current company, breadcrumbs, user menu, theme toggle)
   - Company switcher dropdown in sidebar header
   - Main content area with outlet
4. Wire routes for: dashboard, agents, org, tasks, calendar, files, chat, settings
5. Company switcher fetches all companies for current user, switches context
6. Add loading states and error boundaries

### Task 3: Company Management CRUD
**Files:**
- Modify: `apps/api/src/routes/data.ts` (add company CRUD)
- Create: `apps/api/src/routes/companies.ts`
- Create: `apps/web/src/components/CompanyForm.tsx`
- Modify: `apps/web/src/lib/api.ts`

**Steps:**
1. `GET /companies` — list companies for current user
2. `POST /companies` — create new company (auto-adds user as OWNER)
3. `PUT /companies/:id` — edit company name, goal
4. `POST /companies/:id/members` — invite member (creates company_members entry)
5. `DELETE /companies/:id/members/:userId` — remove member
6. Build UI for: create company modal, edit company form, member list
7. Company creation should also seed default data (default project, default "Ops Agent")

### Task 4: Dashboard (Overview Page)
**Files:**
- Modify: `apps/web/src/pages/OpsDashboard.tsx`
- Modify: `apps/web/src/components/Overview/KpiTiles.tsx`
- Modify: `apps/web/src/components/Overview/StatusWall.tsx`
- Modify: `apps/web/src/components/Overview/OpsTimeline.tsx`
- Modify: `apps/web/src/components/Overview/QuickActions.tsx`
- Modify: `apps/api/src/routes/data.ts` (add dashboard data aggregation)

**Steps:**
1. KpiTiles component: fetch and display:
   - Active agents count
   - Tasks completed today/week
   - Monthly token cost (aggregate from events)
   - Company goal progress
2. StatusWall: real-time grid of agent statuses (idle, running, error, sleeping)
   - Poll every 30s or use SSE when available
3. OpsTimeline: chronological feed of recent agent events
4. QuickActions: buttons for common operations
   - "Create task", "Start agent", "Schedule heartbeat", "Add meeting"
5. All data scoped to currently active company

### Task 5: Task Board (Kanban)
**Files:**
- Modify: `apps/web/src/pages/TaskBoard.tsx`
- Modify: `apps/api/src/routes/tasks.ts` (new file or extend data.ts)

**Steps:**
1. Create task CRUD endpoints (CRU in data.ts is a start, need full)
2. Build kanban with columns: Backlog, Ready, In Progress, Done, Blocked
3. Drag and drop (react-beautiful-dnd or @dnd-kit/core)
4. Task cards show: title, assignee (agent), priority, created date
5. Click task → detail panel with description, comments, agent context
6. Create task form with: title, description, priority, assign agent, assign project
7. Auto-assign option ("best available agent")

### Task 6: Agent Management
**Files:**
- Create: `apps/web/src/pages/AgentsPage.tsx`
- Modify: `apps/api/src/openclaw.ts` (real endpoints)
- Modify: `apps/api/src/connectors/openclaw-poll.ts`

**Steps:**
1. Agent roster page: table of agents per company
2. Agent card: name, role, status, last heartbeat, monthly cost, budget
3. "Add agent" flow: name, role, assign to project, set heartbeat interval, budget
4. Agent detail: recent activity, task history, cost chart
5. OpenClaw poller integration: map real agent status to dashboard
6. Start/stop/pause agent actions
7. Budget tracking: set monthly cap, show usage meter

### Task 7: Calendar & Meetings
**Files:**
- Modify: `apps/web/src/pages/CalendarMeetings.tsx`
- Modify: `apps/api/src/calendar.ts`

**Steps:**
1. Calendar view (react-big-calendar or custom grid)
2. Event CRUD: title, date, time, attendees, agenda
3. Link events to companies/projects
4. Meeting preparation: auto-generate prep tasks for agents
5. Show meetings on dashboard overview

### Task 8: File Hub
**Files:**
- Modify: `apps/web/src/pages/FileHub.tsx`
- Modify: `apps/api/src/files.ts` (or add to routes)

**Steps:**
1. File browser with folder navigation
2. Upload, download, delete files
3. File type icons and preview for common types
4. Scope files to company/project
5. Link files to tasks/journal entries

### Task 9: Chat / Journal
**Files:**
- Modify: `apps/web/src/pages/ChatJournal.tsx`
- Modify: `apps/api/src/chat.ts`

**Steps:**
1. Simple message list with text input
2. Thread organization (topic-based or date-based)
3. Journal entries (rich text or markdown)
4. Link chat to agents (async communication)
5. Search through chat history

### Task 10: Org Chart
**Files:**
- Modify: `apps/web/src/pages/CompanyOrg.tsx`

**Steps:**
1. Visual org chart showing hierarchy
2. Nodes show agent name, role, status
3. Drag to reassign reporting relationships
4. Click node → agent detail panel
5. Show company structure in sidebar mini-org preview

### Task 11: Settings Page
**Files:**
- Create: `apps/web/src/pages/SettingsPage.tsx`
- Create: `apps/web/src/pages/CompanySettingsPage.tsx`

**Steps:**
1. User profile: email, password change
2. Company settings: name, goal, members management (add/remove roles)
3. Theme selection
4. Notification preferences
5. "Danger zone": delete company

---

## Execution Order

```
Phase 1A: Foundation (Day 1-2)
  Task 1: Auth System
  Task 2: Router + Shell Layout
  Task 3: Company Management CRUD

Phase 1B: Core Pages (Day 3-5)
  Task 4: Dashboard (Overview Page)
  Task 5: Task Board (Kanban)
  Task 6: Agent Management

Phase 1C: Additional Pages (Day 6-7)
  Task 7: Calendar & Meetings
  Task 8: File Hub
  Task 9: Chat / Journal
  Task 10: Org Chart
  Task 11: Settings Page
```

---

## Phase 1 Deliverables

When Phase 1 is done, the user should be able to:

1. Open browser, log in with email/password
2. See a company switcher in sidebar
3. Create a new company with one click
4. Switch between companies seamlessly
5. See real operational data in the dashboard
6. Create, assign, and track tasks on a kanban board
7. See agent statuses at a glance (Status Wall)
8. Add/edit agents, set budgets, view costs
9. Schedule meetings on the calendar
10. Upload and manage company files
11. Chat with agents and keep journal entries
12. See the org chart for any company
13. Toggle themes, manage settings, add/remove members

---

## What Comes After Phase 1

- **Phase 2:** Heartbeat system, goal alignment trees, inline charts, command palette, voice/PTT, theme expansion, mobile polish
- **Phase 3:** Plugin system, self-update, Docker deployment, CI/CD, multi-user real-time collaboration, webhook integrations
