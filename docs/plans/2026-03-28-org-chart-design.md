# Org Chart Feature — Design

Date: 2026-03-28

## Summary
Implement a real‑data org chart with a draggable canvas, immediate autosave, and a detail drawer. Supports company‑wide and per‑project scopes. Owner/CEO can edit; others are read‑only.

## Goals
- Org chart for **company** and **project** scope (toggle)
- Canvas drag/drop + pan/zoom
- Autosave on drag/edit; explicit “Save changes” button for reassurance
- Node details in a side drawer
- Real data from API (no mock)

## Non‑Goals (v1)
- Advanced analytics on chart
- Complex multi‑org templates

## Architecture (Approach A — Server‑driven)
- API provides nodes + edges + positions
- UI renders canvas graph
- Drag/role edits PATCH immediately
- Drawer fetches full node metadata

## Components

### Backend
- `GET /orgchart?scope=company|project&id=...`
- `PATCH /orgchart/node/:id` (role/title/parent)
- `PATCH /orgchart/position/:id` (x/y)
- `GET /orgchart/node/:id` (detail for drawer)

### Frontend
- OrgChartCanvas page (pan/zoom, drag)
- Node card (name + role)
- Detail drawer
- Save button (no‑op confirmation)
- Error toast + rollback on failed autosave

## Data Model
- **OrgNode**: id, companyId, projectId?, name, role, status, parentId?, position{x,y}
- **OrgEdge**: id, parentId, childId
- **OrgNodeMeta**: skills[], budget, model, notes

## Data Flow
1) UI requests org chart by scope → API returns nodes/edges/positions  
2) Drag/edit → PATCH → persist → optimistic UI update  
3) Failure → rollback + toast  
4) Click node → drawer loads full metadata

## Error Handling
- Autosave failure → revert + toast
- Permission denied → read‑only banner

## Testing
- API route tests
- UI drag/drop smoke test
- Drawer open test
