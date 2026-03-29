# Mission Control Dashboard — Layout Design (Hybrid)

Date: 2026-03-29

## Goal
Create a “wow” Mission Control dashboard shell that combines Paperclip’s polished visuals with Nerve’s dense, high‑signal ops widgets. The layout must be functional, easy to understand, and feel premium.

## Layout
- **Left sidebar (3‑level tree):** Company → Projects → Agents
  - Each item shows a status dot + unread activity count.
  - Collapsible sections with smooth animation.
- **Top bar:** App title + tabs: **Overview, Chat, Tasks, Calendar, Files**
  - Active tab has a glowing underline and subtle motion.
  - Right side: search, notifications, user avatar.
- **Main content:**
  - **Overview tab** = “wow” page (live status wall + KPIs + activity feed).
  - Other tabs = dedicated layouts with consistent page header.

## Overview “Wow” Section
- **KPI tiles (top row):** Live Agents, Active Tasks, SLA Health, Spend Rate.
- **Realtime Status Wall (center):** grid of agent cards with pulse animation on updates.
- **Ops Timeline (right):** vertical event feed with badges + timestamps.
- **Quick Actions (bottom):** Start project, Add agent, Schedule meeting.

## Company Structure + Goal
- **Company panel** in Overview left column:
  - “Company Goal” card + OKR progress bar.
  - “Org Snapshot” with headcount, teams, vacancies.
- **Org chart** entry point: “View org chart” button.

## Visual System
- **Paperclip feel:** airy spacing, rounded cards, clean typography.
- **Nerve feel:** dense widgets in Overview + high‑signal labels.
- **Theme:** light/dark toggle (default light), consistent accent color.

## Interaction & Data
- Placeholder data first, then real data wiring later.
- Live updates indicated by subtle pulse on cards.
- Empty states are friendly (“No events yet. Connect OpenClaw.”).

## Error Handling
- Inline error banner at top of panel.
- Retry button on data widgets.

## Testing
- Smoke tests for layout presence: sidebar, tabs, overview widgets.
- Visual sanity: ensure all sections render in both themes.

## Notes
- Keep it responsive (desktop + tablet).
- Primary target: polished, instantly understandable, “wow” factor.
