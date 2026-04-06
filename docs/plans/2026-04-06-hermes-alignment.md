# Hermes Alignment Plan — Mission Control as Control Plane

Goal
- Make Hermes the execution engine.
- UI is a control surface: create/approve tasks, view reports, monitor agents.
- Stream Hermes activity and outputs into the UI via logs/events.

Current State (Observed in code)
- Server starts local orchestrator + task worker (apps/api/src/server.ts).
- Task execution is simulated in-app (apps/api/src/task-execution.ts + utils/task-runner.ts + orchestrator/index.ts CEO inbox execution).
- Reports are stored as events (type: ceo_report) and shown on dashboard timeline.
- Agent activity logs recorded via logAgentActivity, stored in agent_logs.
- Hermes connector exists as a stub (apps/api/src/connectors/hermes.ts) but does not execute tasks.

Target Architecture
1) Hermes Execution Service (external/bridge)
- All task execution is delegated to Hermes (CLI/tooling).
- Mission Control only enqueues tasks and records execution state.

2) Execution Bridge API
- New API endpoint(s) to send tasks to Hermes:
  - POST /api/executions (taskId, agentId, companyId, payload)
  - Optional: POST /api/hermes/execute (explicit Hermes endpoint)
- Hermes responds via webhook/ingest:
  - POST /api/executions/:id/events (step logs)
  - POST /api/executions/:id/result (final result)

3) Streaming + Observability
- Use events + agent_logs as the UI data sources.
- Add SSE endpoint to stream events/logs in real time:
  - GET /api/realtime/events?companyId=...
- UI “Reports” shows CEO reports, agent activity, and task status.

4) UI = Control Surface
- Task creation + approvals stay in UI.
- Execution buttons trigger “enqueue to Hermes” only.
- Remove/disable in-app execution logic.

Phase 1: Stop in-app execution and route to Hermes
Files to change
- apps/api/src/server.ts
  - Disable startTaskWorker() and CEO inbox execution that runs local task execution.
- apps/api/src/task-execution.ts
  - Replace executeTaskById() with Hermes dispatch logic.
  - Keep status updates: execStatus transitions only.
- apps/api/src/orchestrator/index.ts
  - Remove “CEO self-execution” or change it to “enqueue to Hermes”.
- apps/api/src/orchestrator/action-executor.ts
  - When assigning/retrying tasks, enqueue to Hermes (not execute locally).

New files
- apps/api/src/execution/dispatcher.ts
  - Creates execution records + posts to Hermes bridge.
- apps/api/src/routes/executions.ts
  - POST /executions (enqueue)
  - POST /executions/:id/events (ingest logs)
  - POST /executions/:id/result (final output)

DB additions
- execution_runs (id, task_id, agent_id, status, provider, started_at, finished_at, result, error)
- execution_events (id, run_id, level, message, meta, created_at)

Phase 2: Stream Hermes activity to UI
Backend
- SSE in routes/realtime.ts to stream execution_events + agent_logs + events.
- Write Hermes tool steps to execution_events and optionally agent_logs.

Frontend
- Reports page: swap to live stream (SSE) + refresh fallback.
- Add “Execution Run” details in Task History.

Phase 3: Hermes-first orchestration
- CEO orchestration produces tasks only (no local execution).
- Hermes handles tool usage; results go back to Mission Control.
- Add “Hermes capability registry” so UI shows which tools are available.

User-Facing Deliverables
Phase 1
- Create task -> shows “Queued for Hermes” and does not fake execution.
- Task status changes only via Hermes callback.

Phase 2
- Live activity feed: see Hermes steps in real time.
- Reports page becomes the single source of truth.

Phase 3
- Full closed loop: brief -> CEO creates tasks -> Hermes executes -> CEO reports -> UI displays.

Decision Points Needed
- Hermes bridge interface: webhook or polling?
- Where Hermes runs (local, server, remote)?
- Authentication for Hermes callback endpoints.

Next Step (If approved)
- Implement Phase 1: execution dispatch + disable local execution.
