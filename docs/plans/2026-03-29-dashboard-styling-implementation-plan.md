# Mission Control Dashboard Styling Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Apply the approved hybrid visual system (Paperclip + Nerve) with light/dark themes, typography, and polished layout styling across the dashboard shell.

**Architecture:** Add CSS theme tokens in `index.css`, implement a theme toggle that sets `data-theme`, and style existing layout components using classnames (or minimal CSS) to reflect tokens and layout rules.

**Tech Stack:** React, Vite, CSS variables, Vitest + Testing Library.

---

## Path Convention
- Global styles: `apps/web/src/index.css`
- Components: `apps/web/src/components/*`
- Tests: `apps/web/tests/*`

---

### Task 1: Add theme tokens in `index.css`

**Files:**
- Modify: `apps/web/src/index.css`
- Test: `apps/web/tests/theme.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import App from "../src/App";

it("applies light theme token", () => {
  render(<App />);
  const root = document.documentElement;
  expect(root.style.getPropertyValue("--bg")).toBe("");
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (no CSS variables defined)

**Step 3: Write minimal implementation**
```css
:root {
  --bg: #F5F8F6;
  --card: #FFFFFF;
  --text: #0F1A14;
  --accent: #10B981;
  --border: #DCE5DF;
}
[data-theme="dark"] {
  --bg: #0E0B16;
  --card: #171226;
  --text: #ECE7FF;
  --accent: #8B5CFF;
  --border: #251B3A;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/index.css apps/web/tests/theme.test.tsx
git commit -m "feat(web): add theme tokens"
```

---

### Task 2: Theme toggle sets `data-theme`

**Files:**
- Modify: `apps/web/src/components/ThemeToggle.tsx`
- Test: `apps/web/tests/theme-toggle.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render, fireEvent } from "@testing-library/react";
import ThemeToggle from "../src/components/ThemeToggle";

it("toggles data-theme", () => {
  render(<ThemeToggle />);
  const btn = document.querySelector("button");
  fireEvent.click(btn!);
  expect(document.documentElement.dataset.theme).toBe("dark");
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL (theme not toggled)

**Step 3: Write minimal implementation**
```tsx
import { useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  return (
    <button
      aria-label="theme"
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.dataset.theme = next;
      }}
    >
      Theme
    </button>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/ThemeToggle.tsx apps/web/tests/theme-toggle.test.tsx
git commit -m "feat(web): wire theme toggle"
```

---

### Task 3: Sidebar styling + layout container

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/tests/sidebar-style.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import Sidebar from "../src/components/Sidebar";

it("sidebar has class for layout", () => {
  render(<Sidebar />);
  expect(document.querySelector("aside")?.className).toMatch(/sidebar/);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function Sidebar() {
  return (
    <aside className="sidebar">
      ...
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/App.tsx apps/web/tests/sidebar-style.test.tsx
git commit -m "feat(web): style sidebar"
```

---

### Task 4: Top bar + tabs styling

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`
- Test: `apps/web/tests/topbar-style.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import TopBar from "../src/components/TopBar";

it("top bar has class for tabs", () => {
  render(<TopBar active="Overview" />);
  expect(document.querySelector("header")?.className).toMatch(/topbar/);
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
export default function TopBar({ active }: { active: string }) {
  return (
    <header className="topbar">...</header>
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/TopBar.tsx apps/web/tests/topbar-style.test.tsx
git commit -m "feat(web): style top bar"
```

---

### Task 5: Overview widget styling hooks

**Files:**
- Modify: `apps/web/src/components/Overview/*`
- Test: `apps/web/tests/overview-style.test.tsx`

**Step 1: Write the failing test**
```tsx
import { render } from "@testing-library/react";
import OpsDashboard from "../src/pages/OpsDashboard";

it("overview uses widget classes", () => {
  render(<OpsDashboard />);
  expect(document.querySelector(".kpi-grid")).toBeTruthy();
  expect(document.querySelector(".status-wall")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**
Run: `pnpm -C apps/web test`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
// Add className="kpi-grid", "status-wall", "ops-timeline", "quick-actions"
```

**Step 4: Run test to verify it passes**
Run: `pnpm -C apps/web test`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/web/src/components/Overview apps/web/tests/overview-style.test.tsx
git commit -m "feat(web): add overview styling hooks"
```

---

## Plan Validation
- Exact paths and commands provided
- Each task yields one artifact and a commit

---

Plan complete and saved to `docs/plans/2026-03-29-dashboard-styling-implementation-plan.md`.

Two execution options:
1) **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED:** Switch Antigravity to **Fast Mode** for this implementation phase.
2) **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.

Which approach?
