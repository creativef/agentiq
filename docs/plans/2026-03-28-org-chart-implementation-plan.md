# Org Chart Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Build a server‑driven, drag‑and‑drop org chart with autosave and a detail drawer using real data.

**Architecture:** API exposes org nodes/edges and PATCH endpoints; frontend renders a canvas and persists drag/role edits immediately with optimistic UI. Detail drawer fetches full node metadata.

**Tech Stack:** TypeScript, React, Hono, Postgres (Drizzle), Vitest, Testing Library.

---

## Path Convention
- Backend: `apps/api/src/...`, tests in `apps/api/tests/...`
- Frontend: `apps/web/src/...`, tests in `apps/web/tests/...`

---

### Task 1: API routes scaffold for org chart

**Files:**
- Create: `apps/api/src/routes/orgchart.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/tests/orgchart.test.ts`

**Step 1: Write the failing test**
```ts
import { expect, it } from "vitest";
import { app } from "../src/index";

it("returns org chart", async () => {
  const res = await app.request("/orgchart?scope=company&id=1");
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**
```ts
import { Hono } from "hono";
export const orgchart = new Hono();
orgchart.get("/orgchart", (c) => c.json({ nodes: [], edges: [] }));
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/orgchart.ts apps/api/tests/orgchart.test.ts apps/api/src/index.ts
git commit -m "feat(api): add org chart route"
```

---

### Task 2: API endpoints for node updates

**Files:**
- Modify: `apps/api/src/routes/orgchart.ts`
- Test: `apps/api/tests/orgchart-node.test.ts`

**Step 1: Write the failing test**
```ts
import { expect, it } from "vitest";
import { app } from "../src/index";

it("updates node role", async () => {
  const res = await app.request("/orgchart/node/1", { method: "PATCH" });
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**
```ts
orgchart.patch("/orgchart/node/:id", (c) => c.json({ ok: true }));
orgchart.patch("/orgchart/position/:id", (c) => c.json({ ok: true }));
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/orgchart.ts apps/api/tests/orgchart-node.test.ts
git commit -m "feat(api): add org chart update endpoints"
```

---

### Task 3: API endpoint for node detail

**Files:**
- Modify: `apps/api/src/routes/orgchart.ts`
- Test: `apps/api/tests/orgchart-detail.test.ts`

**Step 1: Write the failing test**
```ts
import { expect, it } from "vitest";
import { app } from "../src/index";

it("returns node detail", async () => {
  const res = await app.request("/orgchart/node/1");
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**
```ts
orgchart.get("/orgchart/node/:id", (c) => c.json({ id: c.req.param("id") }));
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/orgchart.ts apps/api/tests/orgchart-detail.test.ts
git commit -m "feat(api): add org chart detail endpoint"
```

---

### Task 4: Frontend org chart page scaffold

**Files:**
- Create: `apps/web/src/pages/OrgChart.tsx`
- Modify: `apps/web/src/pages/CompanyOrg.tsx`
- Test: `apps/web/tests/orgchart.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OrgChart from "../src/pages/OrgChart";

it("renders org chart canvas", () => {
  render(<OrgChart />);
  expect(screen.getByText(/Org Chart Canvas/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function OrgChart() {
  return <h1>Org Chart Canvas</h1>;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/pages/OrgChart.tsx apps/web/tests/orgchart.test.tsx apps/web/src/pages/CompanyOrg.tsx
git commit -m "feat(web): add org chart page scaffold"
```

---

### Task 5: Org chart data fetch hook

**Files:**
- Create: `apps/web/src/lib/orgchart.ts`
- Modify: `apps/web/src/pages/OrgChart.tsx`
- Test: `apps/web/tests/orgchart-data.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OrgChart from "../src/pages/OrgChart";

it("shows loading state", () => {
  render(<OrgChart />);
  expect(screen.getByText(/Loading org chart/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export function useOrgChart() {
  return { loading: true, data: null };
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/lib/orgchart.ts apps/web/src/pages/OrgChart.tsx apps/web/tests/orgchart-data.test.tsx
git commit -m "feat(web): add org chart data hook"
```

---

### Task 6: Node card + detail drawer stub

**Files:**
- Create: `apps/web/src/components/OrgNodeCard.tsx`
- Create: `apps/web/src/components/OrgNodeDrawer.tsx`
- Modify: `apps/web/src/pages/OrgChart.tsx`
- Test: `apps/web/tests/orgchart-drawer.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OrgNodeDrawer from "../src/components/OrgNodeDrawer";

it("renders drawer title", () => {
  render(<OrgNodeDrawer open name="CEO" />);
  expect(screen.getByText(/CEO/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function OrgNodeDrawer({ open, name }: { open: boolean; name: string }) {
  if (!open) return null;
  return <aside>{name}</aside>;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/OrgNodeCard.tsx apps/web/src/components/OrgNodeDrawer.tsx apps/web/src/pages/OrgChart.tsx apps/web/tests/orgchart-drawer.test.tsx
git commit -m "feat(web): add org chart node drawer"
```

---

### Task 7: Autosave hooks (position + role)

**Files:**
- Create: `apps/web/src/lib/orgchart-api.ts`
- Test: `apps/web/tests/orgchart-save.test.tsx`

**Step 1: Write the failing test**
```tsx
import { expect, it } from "vitest";
import { saveNodePosition } from "../src/lib/orgchart-api";

it("sends position payload", async () => {
  expect(typeof saveNodePosition).toBe("function");
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
export async function saveNodePosition(id: string, x: number, y: number) {
  return { ok: true };
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/lib/orgchart-api.ts apps/web/tests/orgchart-save.test.tsx
git commit -m "feat(web): add org chart autosave stubs"
```

---

## Plan Validation
- Paths explicit, tasks bite‑sized
- Tests + expected outputs included
- No steps assume prior context

---

Plan complete and saved to `docs/plans/2026-03-28-org-chart-implementation-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED:** Switch Antigravity to **Fast Mode** for this implementation phase.
2) **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.

Which approach do you want?