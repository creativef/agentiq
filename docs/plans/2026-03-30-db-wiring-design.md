# DB Wiring Design (Write + Read)

Date: 2026-03-30

## Goal
Persist OpenClaw events into Postgres and expose real `/companies` and `/events` data.

## Plan
1) Drizzle schema is already extended; ensure fields support inserts.
2) `/connectors/openclaw` validates payload, inserts `events`, upserts `tasks/agents`.
3) `/companies` queries DB for companies; `/events` returns latest N events.
4) Use `DATABASE_URL` env for DB connection (local by default).
5) Tests: mock DB inserts + endpoint returns 200; query endpoints return arrays.
