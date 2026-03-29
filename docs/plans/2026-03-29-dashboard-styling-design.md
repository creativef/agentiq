# Mission Control Dashboard — Styling Design (Hybrid)

Date: 2026-03-29

## Goal
Apply a premium hybrid visual system (Paperclip cleanliness + Nerve intensity) with light/dark themes, refined typography, and polished layout styling.

## Theme Tokens (CSS Variables)
Define in `apps/web/src/index.css` and switch via `data-theme="dark"|"light"`.

**Dark (Midnight + Violet)**
- bg: `#0E0B16`
- card: `#171226`
- text: `#ECE7FF`
- accent: `#8B5CFF`
- border: `#251B3A`

**Light (Mist + Emerald)**
- bg: `#F5F8F6`
- card: `#FFFFFF`
- text: `#0F1A14`
- accent: `#10B981`
- border: `#DCE5DF`

Additional tokens:
- `--muted`, `--shadow`, `--radius`, `--spacing-*`

## Typography
- Body: **Inter**
- Labels/metrics: **JetBrains Mono**
- Scale: h1 32px, h2 20px, body 14–16px, labels 12px

## Layout Styling
- Sidebar: fixed width ~260px, soft border, tree indentation
- Top bar: sticky, tabs with glowing underline in accent color
- Cards: 12px radius, subtle shadow, 1px border using theme border color

## Overview Widgets Styling
- KPI tiles: 4‑column grid (2 on tablet), subtle gradient border
- Status wall: card grid with pulse dot on “active”
- Ops timeline: vertical list with timestamp chips
- Quick actions: pill buttons with accent glow on hover
- Company panel: left column card with OKR bar + snapshot stats

## Theme Toggle
- Toggle switch in top bar; sets `data-theme` on root

## Responsiveness
- Sidebar collapses to icon rail below 1024px
- Tabs wrap on small screens
- Overview grid stacks on tablet

## Testing
- Smoke tests: layout renders with `data-theme` set
- No visual snapshot tests in v1
