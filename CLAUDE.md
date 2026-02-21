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

**User flow:** Landing page (company name input) → agent scrapes negative articles → user picks an article → five pipeline phases execute sequentially → results appear progressively.

**Landing page** (`LandingPage.tsx`): Hero with input, project showcase cards at the bottom with 3D tilt-on-hover effect. Two Spline-ready containers are in place (background scene at `z-[1]` and a secondary slot between input and cards) for adding 3D models later.

**Pipeline phases (planned):**
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
