# UI Data Integration Design (v1)

Date: 2026-03-30

## Goal
Display real data from `/companies` and `/events` in the UI: company list in the sidebar and last event summary in the company panel.

## Plan
1) Add API helper in `apps/web/src/lib/api.ts` for `/companies` and `/events`.
2) Sidebar renders company list + count from `/companies`.
3) Company panel shows latest event from `/events`.
4) Loading/empty states: “No companies yet”, “No events yet”.
5) Poll `/events` every 10–15s for freshness.

## Testing
- Sidebar renders company names from mock data.
- Company panel shows last event summary.
