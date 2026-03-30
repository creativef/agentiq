# UI Data Integration Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Wire `/companies` and `/events` into the UI, showing company list in the sidebar and latest event in the company panel.

**Architecture:** Add API fetch helpers, simple polling for events, and replace placeholder UI with real data + loading/empty states.

**Tech Stack:** React, Vite, Fetch API, Vitest + Testing Library.

---

## Path Convention
- API client: `apps/web/src/lib/api.ts`
- Components: `apps/web/src/components/*`
- Tests: `apps/web/tests/*`

---

### Task 1: API client helpers

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/tests/api.test.tsx`

**Step 1: Write the failing test**
```tsx
import { expect, it } from "vitest";
import { getCompanies } from "../src/lib/api";

it("fetches companies", async () => {
  expect(typeof getCompanies).toBe("function");
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
export async function getCompanies() {
  const res = await fetch("/companies");
  return res.json();
}
export async function getEvents() {
  const res = await fetch("/events");
  return res.json();
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/lib/api.ts apps/web/tests/api.test.tsx
git commit -m "feat(web): add api helpers"
```

---

### Task 2: Sidebar uses companies

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Test: `apps/web/tests/sidebar-data.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import Sidebar from "../src/components/Sidebar";

it("renders company name", () => {
  render(<Sidebar />);
  expect(screen.getByText(/No companies/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
// if companies empty -> "No companies"
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/Sidebar.tsx apps/web/tests/sidebar-data.test.tsx
git commit -m "feat(web): render companies in sidebar"
```

---

### Task 3: Company panel shows last event

**Files:**
- Modify: `apps/web/src/components/Overview/CompanyPanel.tsx`
- Test: `apps/web/tests/company-panel-data.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import CompanyPanel from "../src/components/Overview/CompanyPanel";

it("renders last event", () => {
  render(<CompanyPanel />);
  expect(screen.getByText(/No events/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
// if events empty -> "No events"
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/Overview/CompanyPanel.tsx apps/web/tests/company-panel-data.test.tsx
git commit -m "feat(web): show last event"
```

---

Plan complete and saved to `docs/plans/2026-03-30-ui-data-integration-implementation-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — I execute tasks with checkpoints. **Fast Mode required**.
2) **Parallel Session** — Open new session with executing-plans.

Which approach?
