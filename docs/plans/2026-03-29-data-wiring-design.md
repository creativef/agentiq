# Mission Control — Data Wiring Design (v1)

Date: 2026-03-29

## Goal
Wire real data into the dashboard using a DB-first approach with OpenClaw event ingestion and live updates.

## Architecture
- **DB-first:** Postgres + Drizzle schema for Company, Project, Agent, Task, Event, Chat, Journal, Meeting, File.
- **Ingest:** OpenClaw gateway push to `/connectors/openclaw` + pull fallback via periodic polling.
- **Realtime:** Write events to DB and broadcast via SSE `/events`.

## Data Flow
1. Gateway event → `/connectors/openclaw` → normalize → insert into `events`, update `tasks/agents`.
2. UI uses API for baseline data and SSE for live updates.
3. DB provides persistence for charts, timelines, and audit history.

## API Endpoints (v1)
- `POST /connectors/openclaw` (ingest)
- `GET /companies`, `/projects`, `/agents`, `/tasks`, `/events`
- `GET /events/stream` (SSE)
- CRUD for chat, journal, meetings, files (already scaffolded)

## DB & Config
- Default local Docker Postgres via `DATABASE_URL`
- Managed DB supported via env override
- Drizzle migrations to create tables

## Error Handling
- Idempotent ingestion (event id + upsert)
- Zod validation on payloads
- Clear 400/500 errors and logging

## Testing
- Unit: `normalizeEvent`, upsert logic
- Integration: ingest → DB row created
- UI: live update indicator in Overview
