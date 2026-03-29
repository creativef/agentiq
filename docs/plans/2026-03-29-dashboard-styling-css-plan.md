# Mission Control Dashboard Styling CSS Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Add concrete CSS rules for the layout class hooks so the dashboard renders with the approved visual style.

**Architecture:** Add CSS rules to `apps/web/src/index.css` for layout containers (`.app-shell`, `.sidebar`, `.topbar`, `.kpi-grid`, `.status-wall`, `.ops-timeline`, `.quick-actions`) using the existing theme tokens.

**Tech Stack:** CSS variables, Vite, React.

---

## Path Convention
- Styles live in: `apps/web/src/index.css`

---

### Task 1: App shell + sidebar layout rules

**Files:**
- Modify: `apps/web/src/index.css`
- Test: `apps/web/tests/css-smoke.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import App from "../src/App";

it("applies shell class styles", () => {
  render(<App />);
  const sidebar = document.querySelector(".sidebar") as HTMLElement;
  expect(sidebar).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (test file missing)

**Step 3: Write minimal implementation**
Add CSS:
```css
.app-shell { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; background: var(--bg); color: var(--text); }
.sidebar { padding: 24px; border-right: 1px solid var(--border); background: var(--card); }
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/index.css apps/web/tests/css-smoke.test.tsx
git commit -m "feat(web): add base layout css"
```

---

### Task 2: Topbar + tabs styling

**Files:**
- Modify: `apps/web/src/index.css`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import App from "../src/App";

it("renders topbar class", () => {
  render(<App />);
  expect(document.querySelector(".topbar")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (test missing)

**Step 3: Write minimal implementation**
```css
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--card); position: sticky; top: 0; }
.topbar nav span { margin-right: 12px; padding-bottom: 4px; }
.topbar nav span[aria-current="page"] { border-bottom: 2px solid var(--accent); }
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/index.css apps/web/tests/css-smoke.test.tsx
git commit -m "feat(web): add topbar css"
```

---

### Task 3: Overview widget layouts

**Files:**
- Modify: `apps/web/src/index.css`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import OpsDashboard from "../src/pages/OpsDashboard";

it("overview widget classes exist", () => {
  render(<OpsDashboard />);
  expect(document.querySelector(".kpi-grid")).toBeTruthy();
  expect(document.querySelector(".status-wall")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (test missing)

**Step 3: Write minimal implementation**
```css
.kpi-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0,1fr)); }
.status-wall { margin-top: 16px; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--card); }
.ops-timeline { margin-top: 16px; }
.quick-actions { margin-top: 16px; display: flex; gap: 8px; }
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/index.css apps/web/tests/css-smoke.test.tsx
git commit -m "feat(web): add overview css"
```

---

Plan complete and saved to `docs/plans/2026-03-29-dashboard-styling-css-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks. **REQUIRED:** Fast Mode.
2) **Parallel Session (separate)** — Open new session with executing-plans.

Which approach?
