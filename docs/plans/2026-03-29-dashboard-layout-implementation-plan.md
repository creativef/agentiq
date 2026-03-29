# Mission Control Dashboard Layout Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved hybrid dashboard shell (Paperclip polish + Nerve density) with sidebar tree, top tab bar, and “Overview” wow layout.

**Architecture:** Extend the existing React app shell with layout components (Sidebar, TopBar, Overview widgets), wire routing to tabs, and add lightweight placeholder data for visual structure. Use dedicated components per layout region for clarity and testability.

**Tech Stack:** TypeScript, React + Vite, Tailwind (if present), Vitest + Testing Library.

---

## Path Convention
- UI components: `apps/web/src/components/*`
- Pages: `apps/web/src/pages/*`
- App shell: `apps/web/src/App.tsx`
- Tests: `apps/web/tests/*`

---

### Task 1: Sidebar company/project/agent tree shell

**Files:**
- Create: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/tests/sidebar.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import Sidebar from "../src/components/Sidebar";

it("renders company tree", () => {
  render(<Sidebar />);
  expect(screen.getByText(/Companies/i)).toBeInTheDocument();
  expect(screen.getByText(/Projects/i)).toBeInTheDocument();
  expect(screen.getByText(/Agents/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (Sidebar not found)

**Step 3: Write minimal implementation**
```tsx
export default function Sidebar() {
  return (
    <aside>
      <h2>Companies</h2>
      <div>Acme Co</div>
      <h3>Projects</h3>
      <div>Mission Control</div>
      <h3>Agents</h3>
      <div>Ops Agent</div>
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/App.tsx apps/web/tests/sidebar.test.tsx
git commit -m "feat(web): add sidebar shell"
```

---

### Task 2: Top bar with tabs and active indicator

**Files:**
- Create: `apps/web/src/components/TopBar.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/tests/topbar.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import TopBar from "../src/components/TopBar";

it("renders primary tabs", () => {
  render(<TopBar active="Overview" />);
  expect(screen.getByText(/Overview/i)).toBeInTheDocument();
  expect(screen.getByText(/Chat/i)).toBeInTheDocument();
  expect(screen.getByText(/Tasks/i)).toBeInTheDocument();
  expect(screen.getByText(/Calendar/i)).toBeInTheDocument();
  expect(screen.getByText(/Files/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (TopBar not found)

**Step 3: Write minimal implementation**
```tsx
const tabs = ["Overview", "Chat", "Tasks", "Calendar", "Files"];
export default function TopBar({ active }: { active: string }) {
  return (
    <header>
      <div>Mission Control</div>
      <nav>
        {tabs.map((tab) => (
          <span key={tab} aria-current={tab === active ? "page" : undefined}>
            {tab}
          </span>
        ))}
      </nav>
    </header>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/TopBar.tsx apps/web/src/App.tsx apps/web/tests/topbar.test.tsx
git commit -m "feat(web): add top bar tabs"
```

---

### Task 3: Overview “wow” layout skeleton

**Files:**
- Modify: `apps/web/src/pages/OpsDashboard.tsx`
- Create: `apps/web/src/components/Overview/KpiTiles.tsx`
- Create: `apps/web/src/components/Overview/StatusWall.tsx`
- Create: `apps/web/src/components/Overview/OpsTimeline.tsx`
- Create: `apps/web/src/components/Overview/QuickActions.tsx`
- Test: `apps/web/tests/overview.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import OpsDashboard from "../src/pages/OpsDashboard";

it("renders overview widgets", () => {
  render(<OpsDashboard />);
  expect(screen.getByText(/Live Agents/i)).toBeInTheDocument();
  expect(screen.getByText(/Status Wall/i)).toBeInTheDocument();
  expect(screen.getByText(/Ops Timeline/i)).toBeInTheDocument();
  expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function OpsDashboard() {
  return (
    <section>
      <h1>Overview</h1>
      <div>Live Agents</div>
      <div>Status Wall</div>
      <div>Ops Timeline</div>
      <div>Quick Actions</div>
    </section>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/pages/OpsDashboard.tsx apps/web/src/components/Overview apps/web/tests/overview.test.tsx
git commit -m "feat(web): add overview layout skeleton"
```

---

### Task 4: Company Goal + Org Snapshot panel

**Files:**
- Create: `apps/web/src/components/Overview/CompanyPanel.tsx`
- Modify: `apps/web/src/pages/OpsDashboard.tsx`
- Test: `apps/web/tests/company-panel.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import CompanyPanel from "../src/components/Overview/CompanyPanel";

it("renders company goal", () => {
  render(<CompanyPanel />);
  expect(screen.getByText(/Company Goal/i)).toBeInTheDocument();
  expect(screen.getByText(/Org Snapshot/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function CompanyPanel() {
  return (
    <aside>
      <h2>Company Goal</h2>
      <div>OKR Progress</div>
      <h3>Org Snapshot</h3>
      <div>Headcount</div>
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/Overview/CompanyPanel.tsx apps/web/src/pages/OpsDashboard.tsx apps/web/tests/company-panel.test.tsx
git commit -m "feat(web): add company goal panel"
```

---

### Task 5: Theme toggle (light/dark)

**Files:**
- Create: `apps/web/src/components/ThemeToggle.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/tests/theme-toggle.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";
import ThemeToggle from "../src/components/ThemeToggle";

it("renders theme toggle", () => {
  render(<ThemeToggle />);
  expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function ThemeToggle() {
  return <button aria-label="theme">Theme</button>;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/ThemeToggle.tsx apps/web/src/App.tsx apps/web/tests/theme-toggle.test.tsx
git commit -m "feat(web): add theme toggle shell"
```

---

## Plan Validation
- All file paths are explicit and under `apps/web`
- Each task is bite‑sized and testable
- Commands include expected fail/pass behavior

---

Plan complete and saved to `docs/plans/2026-03-29-dashboard-layout-implementation-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED:** Switch Antigravity to **Fast Mode** for this implementation phase.
2) **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.

Which approach?
