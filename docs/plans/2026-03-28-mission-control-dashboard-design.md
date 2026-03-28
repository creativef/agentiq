# Mission Control Dashboard — Design

Date: 2026-03-28

## Summary
Build a Mission Control web app that lets an Owner spin up companies and projects, appoint CEOs, manage agent workforces, and observe real-time operations. The system integrates with the OpenClaw gateway for live agent/task data and supports chat, daily journals, a built-in calendar, and a file hub.

Design HARD-GATE satisfied: no code scaffolding until design approval.

## Goals (v1)
- Multi-company control plane with strict data isolation
- Role-based access: Owner (all companies), CEO (their company), Agent (their tasks)
- Real-time ops visibility: agent status, task progress, events
- Agent/task board (kanban + filters)
- Chat interface scoped by company/project/agent + daily journal
- Built-in calendar with meeting scheduling + notes
- File hub per company/project (upload/download + Google Drive integration)
- Fast, plug-and-play setup and onboarding

## Non-goals (v1)
- Deep CRM/finance modules
- Complex workflow builders
- Full external calendar integration (future)

## Architecture (Approach A — recommended)
**Control Plane + Pluggable Sources**
- A central dashboard with a normalized company model (Company → Projects → Agents → Tasks/Events)
- OpenClaw gateway as the primary realtime data source
- Optional connectors (Drive now; others later)

**Why:** fastest path to working demo while remaining extensible.

## Core Components
1. **Web App (React UI)**
   - Company selector + org chart
   - Real-time ops dashboard
   - Agent/task board
   - Chat + daily journal
   - Calendar + meetings
   - File hub

2. **API Server (Node + Hono)**
   - Auth + RBAC
   - CRUD for companies/projects/agents/tasks/events
   - Chat/journal/calendar/meetings
   - File hub metadata + Drive bridge
   - OpenClaw gateway connector

3. **Realtime Layer**
   - WebSocket/SSE for live ops updates

4. **Data Layer**
   - Postgres for all entities + audit logs
   - Object storage (local/S3-compatible) + Drive integration

5. **Onboarding/Setup**
   - Wizard: create company → appoint CEO → create project → hire agents → connect OpenClaw
   - Templates for common orgs

## Core Data Model (v1)
- **Company**: id, name, ownerId, settings, createdAt
- **User**: id, name, role (OWNER/CEO/AGENT), companyId
- **Project**: id, companyId, name, status
- **Agent**: id, companyId, projectId, role/title, status, skills, model, costBudget
- **Task**: id, projectId, agentId, status, priority, createdAt, startedAt, finishedAt
- **Event**: id, companyId, projectId, agentId, type, payload, timestamp
- **ChatThread**: id, scope (company/project/agent), title
- **ChatMessage**: id, threadId, sender, body, timestamp
- **JournalEntry**: id, companyId, date, autoSummary, pinnedNotes
- **Meeting**: id, companyId, title, participants, start/end, notes
- **File**: id, scope (company/project), path, storageRef, uploadedBy

All entities are company-scoped by default.

## Data Flow
1. OpenClaw events → **Gateway Connector** → normalize into Events/Tasks/Agent status.
2. UI subscribes to realtime channel for live dashboards and boards.
3. Chat messages stored per scope; daily journal auto-generates from chats + events with editable pinned notes.
4. Calendar/meetings store notes linked to company + participants.
5. File hub stores metadata in DB; blobs in object storage or Drive.

## Memory Strategy
- **Per-project, per-agent, per-company summaries** generated daily or on-demand
- Summaries used to seed new tasks so agents don’t start from scratch

## Roles & Permissions
- **Owner**: all companies + global governance
- **CEO**: full access within their company
- **Agent**: restricted to assigned tasks + relevant chats/files

## Audit & Reliability
- Immutable audit log for admin actions (hire/fire, role changes, budgets)
- Connector health monitoring (gateway heartbeat)
- Idempotent event ingestion
- Realtime fallback to polling

## Must-have Screens (v1)
1. Company selector + org chart
2. Real-time ops dashboard
3. Agent/task board
4. Chat + daily journal
5. Calendar/meetings
6. File hub

## Testing (v1)
- Unit tests for RBAC + data model
- Integration tests for OpenClaw ingestion + realtime
- UI smoke tests for six must-have screens
- Demo flow: create company → appoint CEO → create project → hire agents → observe live dashboard + chat + journal + calendar + files

## Open Questions / Next
- Finalize UI layout and navigation structure
- Confirm file storage choice (local vs S3-compatible) for v1
- Decide initial Google Drive integration depth
