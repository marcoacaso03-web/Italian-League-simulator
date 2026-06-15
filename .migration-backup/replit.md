# Italian League Simulator

A football draft game inspired by 38-0.app. Build your dream Serie A squad from 30 seasons of historical player data, simulate a 38-matchday season, and see where you finish.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/italian-league-simulator run dev` — run the frontend (port from $PORT env)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` — Postgres connection string (not used by game, kept for workspace compat)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + Wouter routing
- API: Express 5 (serves CSV data as JSON)
- Styling: Custom dark theme (`#0a0a0f`) with glass cards, emerald accents, gold shimmer
- Fonts: Inter (Google Fonts, 400–900 weights)

## Where things live

- `artifacts/italian-league-simulator/src/` — frontend source
  - `pages/HomePage.tsx` — landing page
  - `pages/GamePage.tsx` — setup screen + game phase state machine
  - `game/DraftScreen.tsx` — slot machine draft UI + formation pitch
  - `game/SquadPreviewScreen.tsx` — squad overview + pre-season odds
  - `game/SimScreen.tsx` — 38-matchday season simulation animation
  - `game/ResultsScreen.tsx` — final standings + squad recap
  - `lib/data.ts` — async `initData()` that fetches from `/api/data`
  - `lib/draft.ts` — draft logic (slots, spin, pick, reroll)
  - `lib/simulation.ts` — season simulation (Poisson goals, round-robin)
  - `lib/formations.ts` — formation slot definitions (4-3-3, 4-4-2, etc.)
  - `lib/useDraft.ts` — React reducer hook for draft state
  - `components/SlotMachine.tsx` — animated text roller
  - `components/FormationSelector.tsx` — mini pitch formation picker
- `artifacts/api-server/src/routes/data.ts` — CSV parser + `/api/data` endpoint
- `*.csv` — 30 CSV files at workspace root (FC 24, FIFA 05, Stagione 1996-97, etc.)

## Architecture decisions

- CSVs live at workspace root; API server walks up to `pnpm-workspace.yaml` to find root dir
- Vite proxy forwards `/api/*` → `http://localhost:8080` in development
- Data loaded once at app startup via `initData()`, cached in memory on both client and server
- Game phase managed as a state machine in `GamePage.tsx`: setup → draft → preview → sim → results
- Simulation uses Poisson distribution for goal generation with home advantage

## Product

- 7,700+ historical players from 30 Serie A seasons (1996/97 – 2025/26)
- 5 formation options: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2
- 3 difficulty modes (easy/normal/hard), ratings on/off, era filters, draft mode selection
- Prime Mode option: use each player's career-best rating
- 38-matchday season vs 19 Serie A 2025/26 clubs + simulated AI teams

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- API server must run before frontend (Vite proxy target must be live)
- CSV filenames must match the regex patterns in `data.ts` (`buildCsvSeasonMap`)
- `initData()` must resolve before any game screen renders
