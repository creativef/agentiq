# Mission Control Data Wiring Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Wire Postgres persistence and OpenClaw event ingestion (push + pull) into the API and expose live data to the dashboard.

**Architecture:** Add Drizzle schema + migrations, implement connector endpoint for OpenClaw events with idempotent upsert, add polling fallback, and expose data via API + SSE.

**Tech Stack:** Node + Hono, Postgres, Drizzle ORM, Zod, Vitest.

---

## Path Convention
- API: `apps/api/src/...`
- Tests: `apps/api/tests/...`
- Shared schema: `packages/shared/src/...`

---

### Task 1: Drizzle schema for core entities

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Test: `apps/api/tests/schema.test.ts`

**Step 1: Write the failing test**
```ts
import { companies, projects, agents, tasks, events } from "../src/db/schema";

it("defines core tables", () => {
  expect(companies).toBeDefined();
  expect(projects).toBeDefined();
  expect(agents).toBeDefined();
  expect(tasks).toBeDefined();
  expect(events).toBeDefined();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL (missing exports)

**Step 3: Write minimal implementation**
```ts
export const projects = pgTable(...);
export const agents = pgTable(...);
export const tasks = pgTable(...);
export const events = pgTable(...);
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/db/schema.ts apps/api/tests/schema.test.ts
git commit -m "feat(api): extend core schema"
```

---

### Task 2: OpenClaw ingest endpoint (push)

**Files:**
- Create: `apps/api/src/routes/openclaw.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/tests/openclaw-ingest.test.ts`

**Step 1: Write the failing test**
```ts
import { app } from "../src/index";

it("ingests gateway event", async () => {
  const res = await app.request("/connectors/openclaw", { method: "POST" });
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
import { Hono } from "hono";
export const openclaw = new Hono();
openclaw.post("/connectors/openclaw", (c) => c.json({ ok: true }));
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/openclaw.ts apps/api/src/index.ts apps/api/tests/openclaw-ingest.test.ts
git commit -m "feat(api): add openclaw ingest endpoint"
```

---

### Task 3: Event normalization + idempotent upsert

**Files:**
- Modify: `apps/api/src/connectors/openclaw.ts`
- Test: `apps/api/tests/openclaw-normalize.test.ts`

**Step 1: Write the failing test**
```ts
import { normalizeEvent } from "../src/connectors/openclaw";

it("normalizes gateway event", () => {
  const evt = normalizeEvent({ type: "task.started", data: { taskId: "t1" } } as any);
  expect(evt.type).toBe("task.started");
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
export function normalizeEvent(raw: { type: string; data: any }) {
  return { type: raw.type, payload: raw.data, sourceId: raw.data?.id ?? null };
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/connectors/openclaw.ts apps/api/tests/openclaw-normalize.test.ts
git commit -m "feat(api): normalize openclaw events"
```

---

### Task 4: Polling fallback (pull)

**Files:**
- Create: `apps/api/src/connectors/openclaw-poll.ts`
- Test: `apps/api/tests/openclaw-poll.test.ts`

**Step 1: Write the failing test**
```ts
import { pollGateway } from "../src/connectors/openclaw-poll";

it("polls gateway", async () => {
  expect(typeof pollGateway).toBe("function");
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
export async function pollGateway() { return []; }
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/connectors/openclaw-poll.ts apps/api/tests/openclaw-poll.test.ts
git commit -m "feat(api): add gateway polling stub"
```

---

### Task 5: Expose data endpoints

**Files:**
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/data.ts`
- Test: `apps/api/tests/data.test.ts`

**Step 1: Write the failing test**
```ts
import { app } from "../src/index";

it("lists companies", async () => {
  const res = await app.request("/companies");
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
export const data = new Hono();
data.get("/companies", (c) => c.json([]));
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/data.ts apps/api/src/index.ts apps/api/tests/data.test.ts
git commit -m "feat(api): add data endpoints"
```

---

Plan complete and saved to `docs/plans/2026-03-29-data-wiring-implementation-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks. **REQUIRED:** Switch Antigravity to **Fast Mode**.
2) **Parallel Session (separate)** — Open new session with executing-plans.

Which approach?
