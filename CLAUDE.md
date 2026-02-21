# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Crisis PR Agent — a real-time dashboard that displays AI agent outputs as they arrive. Users paste a crisis headline, five pipeline phases execute sequentially, and results appear progressively on screen. A live cost ticker runs in the top bar; the final panel shows an ROI comparison.

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

**Data flow:** User input (InputBar) → App orchestrates five sequential pipeline phases → each phase reveals a dashboard section → CostTicker accumulates cost across phases → ValueDashboard shows final ROI.

**Key hook:** `useWebSocket.ts` — abstracts the WebSocket connection. Currently returns mock data. When the backend team connects, only this hook changes; components stay the same.

**Pipeline phases in order:**
1. CrisisBrief — initial crisis analysis
2. Precedents — historical case lookup
3. StrategyCards — response strategy options
4. DraftViewer — generated PR statement drafts
5. ValueDashboard — ROI comparison (agency vs AI cost)

**Supporting components:**
- PipelineTracker — visualizes which phase is active
- CostTicker — running cost counter in the top bar
- ActivityLog — streaming log of agent actions

## Design Requirements

- Dark mode, premium aesthetic, smooth animations
- Should look like a polished product, not a hackathon prototype
