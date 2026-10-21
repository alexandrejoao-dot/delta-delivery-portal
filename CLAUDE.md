# Delta Hub — Insights & Performance portal (delivery metrics POC)

Central portal for delivery metrics across Global Platforms (squads → Delivery Leads → domains),
built by the Insights & Performance team. This is a **proof of concept on dummy data**;
delivery metrics only. Engineering (DORA), Service & Ops, Risk & Security and Finance are
placeholders in the nav.

## Commands

```bash
npm install
npm run dev           # Vite dev server
npm test              # Vitest — metric engine unit tests
npm run typecheck     # tsc
npm run build         # production build → dist/
npm run build:single  # one self-contained HTML → dist-single/index.html (esbuild + Tailwind, no Vite)
```

Run `npm run typecheck && npm test` before calling any change done.

## Stack

React 19 + TypeScript, Vite, Tailwind CSS v4 (tokens in `src/index.css` `@theme`), `react-icons/md`.
No chart library — charts are small hand-written SVG components in `src/components/charts`.
No router library — tiny hash router in `src/lib/router.tsx` (works on any static host).

## Architecture (read this before changing anything)

```
src/
  data/
    model.ts                 Canonical data model — the ONLY shapes the app reads
    sources/types.ts         DataSource interface
    sources/mock/            Seeded dummy-data generator (behavioural squad profiles)
    sources/eazybi/          eazyBI adapter stub (next step — see below)
    index.ts                 Picks source from VITE_DATA_SOURCE (mock | eazybi)
    DataContext.tsx          Loads the dataset once, exposes useDataset()
  metrics/                   Pure functions, no React. All maths lives here.
    catalogue.ts             Metric definitions + thresholds (the in-app KPI Playbook)
    flow.ts / predictability.ts / quality.ts / stats.ts / period.ts
    pulse.ts                 Pulse check (squad health check survey) scores
    investment.ts            Development category mix
    forecast.ts              Monte Carlo delivery forecast (seeded, deterministic)
    scorecard.ts             All metric values for a group of squads + health signal + health index
    trend.ts                 Metric over trailing windows (sparklines/trend charts)
    insights.ts              Rule-based "conversation starters"
    __tests__/               Vitest
  state/filters.tsx          Scope (all / domain / Delivery Lead / squad), period, team type
  components/                UI kit, layout shell, charts, SquadMatrix, KpiCard
  pages/                     Overview, Predictability (shown as "Health index"), Flow, Quality, Squads (+detail),
                             MetricCatalogue, DataSources, ComingSoon
```

Data flow: `DataSource.load()` → `Dataset` (canonical) → `metrics/*` → pages.
Sources never leak past `data/`; pages never compute metrics inline — add a function in `metrics/`.

## Measurement principles (non-negotiable — they come from the platform decisions)

- **Team type is a first-class dimension.** Scrum: Say/Do, scope change, velocity variability,
  sprint goals. Kanban: throughput variability. Flow and quality apply to both.
- **Never compare velocity or story points across squads.** `velocity` is only computed for a
  single squad (`computeValues` returns NaN for groups). Throughput is shown with a caveat.
- **Pods are a point-in-time attribute** (`WorkItem.podId`), never a grouping key. Long-run
  trends anchor on squad / initiative / value stream.
- **Trusted partner, not oversight.** Signals are "On track / Watch / Needs attention", every
  badge is traceable to the metrics behind it, insights are phrased as coaching prompts, and
  squads get their own view ("Make this my view") before comparative views are pushed to leadership.
- **Thresholds live only in `metrics/catalogue.ts`.** The Metric catalogue page renders from it,
  so definitions and the numbers can't drift apart.
- Pooled metrics (Say/Do, scope change) are points-weighted; variability metrics use the median
  squad, because pooling would measure team-size differences rather than instability.
- All "current" values are relative to `dataset.asOf` (snapshot time), never `Date.now()`.

## Design system

"Precision Enterprise" (from the Stitch designs): Inter, slate primary `#091426`, white cards
with 1px `outline-variant` border and no shadow, 4px radius, dark sidebar with left accent bar.
Status colours are reserved for state and always paired with an icon + label (`StatusBadge`).
Chart series use a fixed categorical order (`--color-series-1..3`), one y-axis per chart,
hover tooltips on every chart, legends for 2+ series.

## Dummy data

`generateDataset()` is deterministic (seeded). 12 fictional squads in 3 domains, 4 Delivery Leads,
~2,400 work items over ~7 months, 13 sprints per Scrum squad. Each squad has a profile so the
portal has stories to show: Borealis (scope creep), Granite (over-commitment), Ember (bug
ratio climbing), Fjord (flow slowing), Juno (volatile velocity), Lumen (throughput dropping),
Iris (improving), Atlas/Dune/Halo/Kestrel/Cobalt (healthy). Snapshot: 2 Oct 2026.
Monthly pulse checks (7 per squad) and work categories (feature / tech debt / maintenance / defect)
echo those stories (e.g. Granite's pulse is low, Ember's "Health of codebase" drops, Juno carries more
tech debt). Later additions use their own RNG stream (`seed + n`) so existing generated values never shift.

## Next steps (suggested order)

1. **Wire eazyBI** (`src/data/sources/eazybi/eazybiSource.ts` has the plan):
   - Extraction job outside the browser (Python or Node) calling eazyBI report export API on a
     schedule; credentials never reach the front end.
   - Map exports → `Dataset` (canonical model) and write dated snapshots (JSON + Parquet/DuckDB)
     to keep history for future migration validation.
   - Front end fetches the latest snapshot via `VITE_SNAPSHOT_URL`, `VITE_DATA_SOURCE=eazybi`.
   - Needed reports: issues with created / first-In-Progress / resolved dates, type, points,
     epic→initiative; sprint scope (committed, added, removed, completed-of-committed, completed-of-added).
2. Auth + role-based default scope (squad members land on their squad).
3. Persist shareable views in the URL (scope + period as query params).
4. Forecasting: "how many in 2 weeks?" is live (matrix column); add "when will it be done?" for a backlog / initiative.
5. Next domain: Engineering (DORA) — add entities (deployments, incidents) to the model + an adapter.
6. Pod metrics (formation-to-productivity, handoff overhead) — only after scope is agreed.

## Conventions

- Keep metric functions pure and unit-tested; add a test with every new metric.
- New metric = entry in `catalogue.ts` + function in `metrics/` + value in `computeValues` + test.
- UI text: British English, sentence case, no blame language.
- Don't introduce a chart library unless a chart genuinely can't be built with the existing kit.
