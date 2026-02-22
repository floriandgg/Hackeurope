# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Crisis PR Agent — an AI-powered crisis communications tool. The user enters a company name on the landing page. AI agents scrape for the most recent negative press, display the articles, and let the user select which crisis to respond to. From there, a multi-phase pipeline generates PR strategy, talking points, and response drafts.

## Tech Stack

- React 18 via Vite
- TypeScript
- Tailwind CSS v3

## Commands

All commands run from the `frontend/` directory:

- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **Type check:** `npx tsc --noEmit`

## Architecture

The frontend lives entirely in `frontend/src/`. Data currently comes from mock sources; the backend will connect via WebSocket later.

**User flow:** Landing page (company name input) → bubble transition → article discovery page (agent timeline + topic cards) → user picks a topic → expanded view with articles → "Respond to Topic" → strategy page (3 response strategies) → "See Why" → precedents page (historical case timeline) / "View Drafts" → (planned) draft generation and remaining pipeline phases.

**App.tsx:** Manages view state (`landing` | `discovery` | `strategy` | `precedents` | `drafts`) and a FLIP-style bubble transition between landing and discovery. Passes `onRespondToTopic` callback down to discovery page, which triggers navigation to the strategy view with topic context. From strategy, `onSeeWhy` navigates to the precedents view; `onViewDrafts` navigates to the drafts view with the selected strategy index. `onBack` from precedents or drafts returns to strategy.

**Landing page** (`LandingPage.tsx`): Hero with textarea input, project showcase cards at the bottom with 3D tilt-on-hover effect (`TiltCard` component). Two Spline-ready containers are in place (background scene at `z-[1]` and a secondary slot between input and cards) for adding 3D models later. Desktop uses a fanned card layout; mobile uses a horizontal scroll.

**Article discovery page** (`ArticleDiscoveryPage.tsx`): Split-view layout — left sidebar shows an animated agent activity timeline (6 steps with sequential progress), right panel displays topic cards in an overlapping stack. Topics fan out on hover. Clicking a topic triggers a FLIP card-expand animation into a detail view showing urgency score, summary, a "Respond to Topic" button, and a stacked row of individual article cards. All data is currently mock (`TOPIC_GROUPS` with 3 topic groups, 10 articles total). Articles have criticality scores (1–10) with color-coded badges (red ≥8, amber ≥5, gray below). The "Respond to Topic" button calls `onRespondToTopic` with the topic's name and summary.

**Strategy page** (`StrategyPage.tsx`): Displays 3 predefined response strategies — "Own It" (green, low risk), "Reframe" (amber, medium risk), "Hold the Line" (red, very high risk). Each card shows description, risk level, trust recovery speed, and best-for scenario. "Own It" is marked as recommended. Cards have tilt-on-hover effect. A "View Drafts →" button on each card calls `onViewDrafts(strategyIndex)` to navigate to the drafts page. A "See Why" button below the cards navigates to the precedents page via `onSeeWhy`.

**Precedents page** (`PrecedentsPage.tsx`): Split-view layout matching the article discovery page — left sidebar shows an animated agent activity timeline (6 steps: identify category → scan database → rank similarity → analyze outcomes → extract lessons → compile report), right panel displays a vertical timeline of 4 historical precedent cases (J&J 1982, VW 2015, Equifax 2017, Starbucks 2018). Each case card shows company/year, crisis description, type badge, strategy used, outcome badge (green "Recovered" / red "Damaged" with outcome detail), a blockquote-style lesson, and article cards matching the style from other pages (white, 195×160px, publisher badge, serif title, date). Cases reveal progressively as agent steps complete. A "Key Insight" summary card appears after all cases load. All data is currently mock.

**Draft viewer page** (`DraftViewerPage.tsx`): Accessible via "View Drafts" on the strategy page. Shows an interactive horizontal crisis timeline at the top (5 nodes: Crisis Detected → Analysis → Strategy → Drafts Ready → Distribution). Below the timeline, horizontal channel tabs (Press Release, Twitter/X, Internal Memo, Stakeholder Email, Media Q&A) sit above a draft text viewer that displays strategy-aware mock content — each of the 3 strategies generates different tone/content for all 5 channels. A full-width tone analysis panel at the bottom shows 5 sentiment metrics (Empathy, Accountability, Authority, Urgency, Reassurance) as animated progress bars color-coded by intensity. Props: `companyName`, `topic`, `strategyIndex`, `onBack`.

**Pipeline phases (remaining, not yet built):**
1. CrisisBrief — initial crisis analysis
2. ValueDashboard — ROI comparison (agency vs AI cost)

## Design

- Light theme with muted blue-gray palette (royal `#2b3a8f`, steel `#5a7d95`, storm `#6d8a9e`, mist `#e8eaf0`, periwinkle `#c8cce8`)
- Fonts: Instrument Serif (display) + Outfit (body) via Google Fonts
- Smooth staggered entrance animations, cursor-tracking card tilt
- Should look like a polished product, not a hackathon prototype
