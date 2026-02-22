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

**User flow:** Landing page (company name input) → bubble transition → article discovery page (agent timeline + topic cards) → user picks a topic → expanded view with articles → (planned) five pipeline phases execute sequentially → results appear progressively.

**App.tsx:** Manages view state (`landing` | `discovery`) and a FLIP-style bubble transition between views. The input card's bounding rect is captured and expanded to fill the viewport before swapping views.

**Landing page** (`LandingPage.tsx`): Hero with textarea input, project showcase cards at the bottom with 3D tilt-on-hover effect (`TiltCard` component). Two Spline-ready containers are in place (background scene at `z-[1]` and a secondary slot between input and cards) for adding 3D models later. Desktop uses a fanned card layout; mobile uses a horizontal scroll.

**Article discovery page** (`ArticleDiscoveryPage.tsx`): Split-view layout — left sidebar shows an animated agent activity timeline (6 steps with sequential progress), right panel displays topic cards in an overlapping stack. Topics fan out on hover. Clicking a topic triggers a FLIP card-expand animation into a detail view showing urgency score, summary, a "Respond to Topic" button, and a stacked row of individual article cards. All data is currently mock (`TOPIC_GROUPS` with 3 topic groups, 10 articles total). Articles have criticality scores (1–10) with color-coded badges (red ≥8, amber ≥5, gray below).

**Pipeline phases (planned, not yet built):**
1. CrisisBrief — initial crisis analysis
2. Precedents — historical case lookup
3. StrategyCards — response strategy options
4. DraftViewer — generated PR statement drafts
5. ValueDashboard — ROI comparison (agency vs AI cost)

## Design

- Light theme with muted blue-gray palette (royal `#2b3a8f`, steel `#5a7d95`, storm `#6d8a9e`, mist `#e8eaf0`, periwinkle `#c8cce8`)
- Fonts: Instrument Serif (display) + Outfit (body) via Google Fonts
- Smooth staggered entrance animations, cursor-tracking card tilt
- Should look like a polished product, not a hackathon prototype
