# DB Wiring Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Persist events and expose real DB-backed `/companies` and `/events` endpoints.

**Architecture:** Add DB client, update OpenClaw ingest to insert events + upsert entities, and implement data queries.

**Tech Stack:** Node + Hono, Drizzle ORM, Postgres, Vitest.

---

## Path Convention
- API: `apps/api/src/...`
- Tests: `apps/api/tests/...`

---

### Task 1: Add DB client

**Files:**
- Create: `apps/api/src/db/client.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/tests/db-client.test.ts`

**Step 1: Write the failing test**
```ts
import { expect, it } from "vitest";
import { db } from "../src/db/client";

it("exports db client", () => {
  expect(db).toBeDefined();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL ?? "");
export const db = drizzle(client);
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/db/client.ts apps/api/tests/db-client.test.ts apps/api/src/index.ts
git commit -m "feat(api): add db client"
```

---

### Task 2: Ingest inserts events

**Files:**
- Modify: `apps/api/src/routes/openclaw.ts`
- Test: `apps/api/tests/openclaw-insert.test.ts`

**Step 1: Write the failing test**
```ts
import { app } from "../src/index";

it("inserts event", async () => {
  const res = await app.request("/connectors/openclaw", { method: "POST" });
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
// insert into events table
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/openclaw.ts apps/api/tests/openclaw-insert.test.ts
git commit -m "feat(api): insert events on ingest"
```

---

### Task 3: Query `/companies` + `/events`

**Files:**
- Modify: `apps/api/src/routes/data.ts`
- Test: `apps/api/tests/data-query.test.ts`

**Step 1: Write the failing test**
```ts
import { app } from "../src/index";

it("returns events", async () => {
  const res = await app.request("/events");
  expect(res.status).toBe(200);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/api test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
// select from events + companies
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/api test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/api/src/routes/data.ts apps/api/tests/data-query.test.ts
git commit -m "feat(api): query companies and events"
```

---

Plan complete and saved to `docs/plans/2026-03-30-db-wiring-implementation-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — execute tasks with checkpoints. **Fast Mode required**.
2) **Parallel Session** — use executing-plans.

Which approach?
