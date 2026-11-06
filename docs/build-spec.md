# Delta Hub — build specification

Nov 5, 2026 · @João

## How to use this spec

This document describes Delta Hub completely in words, with no code, so it can be rebuilt from scratch by Claude Code on another computer. Build it in the 8 steps of the last section, one step per session, and check each step's acceptance list before moving on.

1. Create an empty folder, save this document in it as `SPEC.md`, and open Claude Code there.
2. Ask: "Read SPEC.md. Build step 1 only, then show me how to run it." Then step 2, and so on.
3. After each step, ask Claude to run the type check and tests, and open the app to compare with the acceptance checks.
4. Ask Claude to keep a short `CLAUDE.md` with the principles in section 1, so later sessions follow them.

Where this spec gives exact numbers (thresholds, profiles, seed), use them: the checks depend on them. Where it gives only intent (layout details, wording), Claude may choose. The dummy data is random but seeded, so the rebuilt numbers will be close to, not identical with, the original.

## 1. Purpose and principles

Delta Hub (subtitle "Insights & Performance") is a portal of delivery metrics for an engineering organisation: teams, grouped into domains, pods and Delivery Leads. It starts as a proof of concept on seeded dummy data, built so a real source (eazyBI exports from Jira) can replace the dummy data without touching metrics or pages.

**Audiences** ("altitudes", chosen in the top-bar scope):

- All Areas: leadership, every team.
- Domain: a domain manager.
- Delivery Lead: that person's teams.
- Team: one team, which sees its own data first.
- Pod: a group of teams.

**Measurement principles.** These are non-negotiable; put them in `CLAUDE.md`.

- **Team type is first-class.** Scrum and Kanban are measured differently. Scrum only: completion ratio (Say/Do), scope change, velocity variability, sprint goals. Kanban only: throughput variability. Flow, quality, health and forecasting apply to both.
- **Never compare velocity or story points across teams.** Velocity is shown only for a single team; for a group it is "not available". Throughput across teams carries a caveat.
- **Trusted partner, not oversight.** Signals are "On track", "Watch" and "Needs attention", always icon + label. Every signal can be traced to the metrics behind it. Insights are phrased as coaching questions, never blame.
- **Thresholds live in one place**, the metric catalogue, which also renders the in-app Metric catalogue page, so definitions and numbers cannot drift apart.
- **Pooling rules.** Ratio metrics (completion ratio, scope change) are pooled and weighted by points. Variability metrics use the median team, because pooling would measure team size, not instability. Per-team scores (health index, pulse) are averaged so each team counts once.
- **Snapshot time.** Every "current" value is relative to the dataset's snapshot date, never the computer clock.
- **Naming.** The UI says "team"/"teams" everywhere. UI text is British English, sentence case.
- **Dummy data is labelled.** A thin banner on every page says it is a proof of concept on dummy data, with the snapshot date.

## 2. Stack and architecture

A single-page web app with no back end: it loads one dataset, computes every metric in the browser, and renders pages from the results.

| Concern | Choice |
| --- | --- |
| Language and UI | React 19 + TypeScript (strict) |
| Build and dev server | Vite, served on port 5173 |
| Styling | Tailwind CSS v4, with design tokens in the stylesheet's theme block (section 9) |
| Icons | Material Design icons from `react-icons/md` |
| Charts | Small hand-written SVG components; no chart library |
| Routing | A tiny hash router (`#/health`), so the build works on any static host or as one HTML file |
| Tests | Vitest, for the metric functions |

**Layers.** Data flows one way: data source → canonical dataset → metric functions → pages.

- `data/model` holds the canonical data model (section 3), the only shapes the app reads.
- `data/sources/*` holds one folder per source (`mock`, `eazybi`). Each source has an id, a label and a load function that returns a dataset. An environment variable picks the source (`VITE_DATA_SOURCE=mock|eazybi`, default mock).
- A data context loads the dataset once and exposes it to every page, with a loading state and an error state.
- `metrics/*` holds pure functions with no React, one file per family (flow, predictability, quality, pulse, investment, forecast, period, stats, trend, insights, highlights, scorecard, catalogue). All maths lives here.
- `state/filters` holds the scope and period (section 7).
- `components/*` holds the UI kit, app shell, charts, team matrix and KPI card. `pages/*` holds one file per page.

**Rules.**

- Pages never compute a metric inline; they call a function in `metrics/`.
- Sources never leak past `data/`.
- A new metric = an entry in the catalogue + a pure function + a value in the scorecard + a unit test.
- Scorecards are memoised per (dataset, teams, period), because several cards on a page ask for the same one. Datasets are never mutated.
- Performance target: every page change under 100 ms for 12 teams.

## 3. Data model

One `Dataset` object holds everything. Dates are ISO strings (UTC), so a snapshot can be saved as JSON. In code the team entity is called `Squad` (field `squadId`); the UI always says "team".

| Entity | Fields |
| --- | --- |
| Dataset | `asOf` (snapshot timestamp) · `source` {id, label, isDummy} · `domains` · `valueStreams` · `deliveryLeads` · `pods` · `squads` · `initiatives` · `workItems` · `sprints` · `pulseChecks` |
| Domain | id · name · manager |
| ValueStream | id · name · domainId |
| DeliveryLead | id · name |
| Pod (group of teams) | id · name |
| Squad (team) | id · name · domainId · valueStreamId · deliveryLeadId · podId (or null) · teamType (`scrum` or `kanban`) · boardKey (Jira project key) |
| Initiative | id · name · domainId · valueStreamId · targetDate · status (not started, in progress, done) |
| WorkItem | key (Jira key) · squadId · type (story, bug, task) · category · summary · storyPoints (or null) · initiativeId (or null) · createdAt · startedAt (first move to In Progress, or null) · doneAt (move to Done, or null) |
| Sprint (Scrum only) | id · squadId · name · startDate · endDate · committedPoints · completedCommittedPoints · addedPoints · completedAddedPoints · removedPoints · goal · goalMet (true, false, or null when not recorded) |
| PulseCheck | id · squadId · date · respondents · scores (one 1–5 mean per dimension) |

**Work categories** (fixed order, which is also the colour order): OKR aligned, Non-OKR aligned, Keep the lights on, L&D, None. "None" means not categorised in Jira; it is shown so the mix always adds up to everything finished.

**Pulse dimensions** (after the Spotify squad health check), in order: Delivering value, Easy to release, Health of codebase, Speed, Suitable process, Mission, Fun, Learning, Support, Pawns or players. Their ids, in the same order: value, release, codebase, speed, process, mission, fun, learning, support, autonomy; the profiles in section 6 use these ids. Pulses are aggregated per team, never per person. A pulse with fewer than 3 respondents is hidden.

## 4. Periods, windows and trends

The user picks a period of 30, 90 or 180 days (default 90). The **current window** is the period ending at the snapshot. The **previous window** is the equal-length period just before it, and every "vs prev." delta compares the two.

- A date is inside a window when it is after the start and at or before the end.
- An item counts in a window when its `doneAt` falls in it. A sprint counts when its `endDate` falls in it.
- Week buckets are 7-day windows ending at the snapshot, oldest first.
- WIP and ageing are measured at the end of a window, so past windows work for deltas and trends. WIP itself is shown only for the current window.

**Trends** recompute one metric over trailing windows that end every few days, oldest first. Each point is a full metric value for that window.

| Metric | Points | Step (days) | Window (days) |
| --- | --- | --- | --- |
| Completion ratio, scope change, velocity | 12 | 14 | 14 |
| Sprint goal hit rate | 12 | 14 | 42 |
| Velocity variability | 8 | 14 | 84 |
| Throughput variability | 12 | 14 | 56 |
| Pulse check | 7 | 28 | 28 |
| Everything else | 12 | 14 | 28 |

Trend x-axis labels are the window end dates, written as day + short month ("2 Oct").

## 5. Metric catalogue

Eighteen metrics, each defined once in the catalogue. A definition has: id, name, category, unit, direction (higher, lower or neutral), team types, description, formula, source, optional thresholds {good, watch} and an optional caveat. The Metric catalogue page renders these definitions as they stand. Categories, in this order: Predictability (sayDo, scopeChange, velocity, velocityCv, goalHitRate, throughputCv); Flow (throughput, cycleP50, cycleP85, leadP85, wip, ageingWipShare); Quality (bugRatio); Health (healthIndex, pulseScore); Investment (okrShare); Forecast (deliveryForecast, forecastAccuracy).

| Id | Name | Unit | Better | Teams | Formula (window = current period) | On track | Watch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sayDo | Commitment reliability (Say/Do); "Completion ratio" on Health index | % | higher | Scrum | Σ completed committed points ÷ Σ committed points, sprints ending in window | ≥ 80% | ≥ 65% |
| scopeChange | Mid-sprint scope change; "Scope volatility" on Health index | % | lower | Scrum | Σ added points ÷ Σ committed points | ≤ 15% | ≤ 30% |
| velocity | Velocity | pts | neutral | Scrum | mean of (completed committed + completed added) per sprint; single team only | — | — |
| velocityCv | Velocity variability; "Stability" (Scrum) | % | lower | Scrum | stdev ÷ mean of sprint velocity, per team (needs ≥ 3 sprints); groups = median team | ≤ 20% | ≤ 30% |
| goalHitRate | Sprint goal hit rate | % | higher | Scrum | sprints with goal met ÷ sprints with a recorded outcome | ≥ 70% | ≥ 50% |
| throughput | Throughput | /wk | neutral | both | items done ÷ weeks in window | — | — |
| throughputCv | Throughput variability; "Stability" (Kanban) | % | lower | Kanban | stdev ÷ mean of weekly done counts (weeks = window ÷ 7, at least 2); groups = median team | ≤ 35% | ≤ 50% |
| cycleP50 | Cycle time (50th pct) | days | lower | both | 50th percentile of (doneAt − startedAt), items done in window | — | — |
| cycleP85 | Cycle time (85th pct) | days | lower | both | 85th percentile of the same | ≤ 10d | ≤ 15d |
| leadP85 | Lead time (85th pct) | days | lower | both | 85th percentile of (doneAt − createdAt) | ≤ 20d | ≤ 28d |
| wip | Work in progress | count | neutral | both | items started and not done at the snapshot | — | — |
| ageingWipShare | Ageing WIP | % | lower | both | WIP older than the p85 cycle time of the 90 days before ÷ WIP, at window end | ≤ 20% | ≤ 40% |
| bugRatio | Bug ratio | % | lower | both | bugs done ÷ all items done | ≤ 20% | ≤ 30% |
| healthIndex | Health index | 0–100 | higher | both | see below | ≥ 80 | ≥ 50 |
| pulseScore | Pulse check | /5 | higher | both | mean of dimension scores from each team's latest reportable pulse; groups = mean of teams | ≥ 3.8 | ≥ 3.3 |
| okrShare | Development categories (headline = OKR-aligned share) | % | neutral | both | items done per category ÷ items done | — | — |
| deliveryForecast | Delivery forecast | items | neutral | both | Monte Carlo, see below | — | — |
| forecastAccuracy | Forecasting accuracy | % | higher | both | share of past weekly forecasts that came true, see below | ≥ 80% | ≥ 65% |

**Signals.** For a higher-is-better metric: value ≥ good → On track; ≥ watch → Watch; otherwise Needs attention. Lower-is-better is the mirror. No thresholds, or no value → no signal.

**Improvement.** A change is better or worse only when the metric has a direction and both values exist. A change that disappears at display precision (percent to 1 point; index and items to 1; others to 0.1) is "unchanged" and coloured neutral.

**Scores (0–100).** Each thresholded metric converts to a score anchored on its own thresholds: 100 at "good" (capped, so beating the target earns nothing extra), 50 at "watch", 0 one more band out (zero = watch + (watch − good)), linear in between.

```latex
\text{score} = 100 \times \operatorname{clamp}_{[0,1]}\left(\frac{v - \text{zero}}{\text{good} - \text{zero}}\right)
```

**Health index.** Per team, it is the mean score of its inputs; it needs at least 3 scorable inputs, otherwise it shows no value. Scrum inputs: completion ratio, cycle time p85, velocity variability, scope change, lead time p85, pulse check. Kanban inputs: cycle time p85, throughput variability, lead time p85, pulse check. A group shows the mean of its teams' indexes, so each team counts once.

**Team health signal** (team list and matrix). Scrum looks at completion ratio, scope change, velocity variability, cycle time p85, ageing WIP and bug ratio; Kanban looks at throughput variability, cycle time p85, ageing WIP and bug ratio. Any metric at Needs attention → Needs attention; two or more at Watch → Watch; else On track. The reasons listed are the metrics behind the signal.

**Delivery forecast.** Take the daily done counts of the last 84 days. Simulate the next 14 days 2,000 times, each day drawn at random from that history. The forecast is "at least N items" with 85% confidence: the 15th percentile of the totals, rounded down. Seed the random draws from the history itself, so the same history always gives the same forecast: seed = (number of days × 7919) + total items in the history, using the same mulberry32 generator as the dummy data. All-zero history gives no value. Exact mechanics: a day's bucket is floor((doneAt − historyStart) ÷ 1 day), counting items with historyStart < doneAt ≤ historyEnd; each simulated day picks history[floor(rng.next() × history length)]; a new generator is created for every forecast (backtests included, which use 500 simulations with the same seed rule); "actual" counts items with madeAt < doneAt ≤ step end.

**Forecasting accuracy.** Step back one week at a time from the window end, for as long as the step's end is still after the window start (a 90-day window gives 13 forecasts); skip steps whose history gives no forecast. For each step, make the forecast from the history available 14 days earlier (500 simulations), and count the items actually finished in those 14 days. Accuracy = share of forecasts where actual ≥ forecast. A well-calibrated forecast is met about 85% of the time.

**Pulse movers.** Pair each team's latest pulse in the current window with its latest in the previous window; only teams with both count. Per dimension, compare the mean scores. The biggest rise and the biggest fall are shown; either can be absent.

**Statistics.** Percentiles interpolate linearly. Standard deviation is the sample one (n − 1). CV = stdev ÷ mean, and is undefined when the mean is 0.

**Number formats.** Percent as a whole number ("79%"). Days to one decimal ("7.9d" in tiles, "7.9 days" elsewhere). Points rounded ("42 pts"). Per week to one decimal. Index rounded ("86/100" in tiles). Score to one decimal ("3.6/5"). Missing values show "—". Deltas on percentages are percentage points ("pp").

## 6. Dummy data generator

A seeded generator gives 12 fictional teams in 3 domains, about 2,400 work items over 220 days, 13 sprints per Scrum team and 7 monthly pulses per team. Each team follows a behavioural profile, so the portal has stories to show. Same seed → same data on every load. Seed: 20261002. Snapshot: 2 Oct 2026, 18:00 UTC.

**Random numbers.** Use a small deterministic generator (mulberry32) with these helpers:

- uniform in \[0, 1) and between two values;
- integer in a range, pick from a list, and a chance with probability p;
- standard normal (Box–Muller);
- log-normal from a median and sigma (exp(ln median + sigma × normal));
- Poisson.

Use separate streams for the categories (seed + 1) and the pulses (seed + 2), so adding them never shifts other values.

**Organisation.**

| Domain (manager) | Value streams |
| --- | --- |
| Player Experience (Marta Reis) | Onboarding & Account; Engagement |
| Payments & Wallet (Rui Matos) | Deposits; Withdrawals & Risk |
| Core Platform (Inês Carvalho) | Identity & Access; Platform Services |

Delivery Leads: Ana Sousa, Pedro Lima, Sofia Costa, Tiago Nunes.

Each value stream has 2 initiatives, both in progress. The first is due 30 days after the snapshot, the second 95 days after.

- Onboarding & Account: Frictionless sign-up, KYC automation.
- Engagement: Personalised home feed, Rewards hub.
- Deposits: Open banking deposits, Payment method expansion.
- Withdrawals & Risk: Instant withdrawals, Fraud signal v2.
- Identity & Access: Passkeys rollout, Session hardening.
- Platform Services: Service mesh migration, Observability baseline.

**Teams.**

| Team | Type | Board | Domain · value stream | Delivery Lead | Pod | Story |
| --- | --- | --- | --- | --- | --- | --- |
| Atlas | Scrum | ATL | Player · Onboarding | Ana Sousa | Growth | Healthy and improving |
| Borealis | Scrum | BOR | Player · Engagement | Ana Sousa | Growth | Scope creep erodes commitments |
| Cobalt | Kanban | COB | Player · Engagement | Ana Sousa | Growth | Healthy |
| Dune | Scrum | DUN | Payments · Deposits | Pedro Lima | Checkout | Healthy |
| Ember | Scrum | EMB | Payments · Deposits | Pedro Lima | Checkout | Bug share climbing; codebase pulse falls |
| Fjord | Kanban | FJO | Payments · Withdrawals | Pedro Lima | Risk & Compliance | Flow slowing; ageing WIP grows |
| Granite | Scrum | GRA | Payments · Withdrawals | Sofia Costa | Risk & Compliance | Chronic over-commitment; low pulse |
| Halo | Scrum | HAL | Core · Identity | Sofia Costa | Identity | Healthy |
| Iris | Kanban | IRI | Core · Identity | Sofia Costa | Identity | Improving after a WIP-limit experiment |
| Juno | Scrum | JUN | Core · Platform | Tiago Nunes | Foundations | Volatile velocity; more non-OKR work |
| Kestrel | Scrum | KES | Core · Platform | Tiago Nunes | Foundations | Healthy |
| Lumen | Kanban | LUM | Core · Platform | Tiago Nunes | Foundations | Throughput dropping |

**Profiles.** "a→b" means the value moves linearly from the start of history (a) to the end (b).

| Team | Items/wk | Cycle median (d) | Cycle sigma | Wait median (d) | Bug share | Velocity (noise) | Say/Do | Scope change | Pulse base | Pulse offsets |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Atlas | 6→7.5 | 4.5→3.4 | 0.55 | 6 | 0.18→0.14 | 42 (0.08) | 0.80→0.90 | 0.08 | 3.9→4.2 | — |
| Borealis | 7→6.5 | 4→5.2 | 0.6 | 5 | 0.20→0.22 | 48 (0.12) | 0.84→0.63 | 0.34 | 3.9→3.4 | process −0.6, mission −0.4 |
| Cobalt | 8→9 | 3→2.7 | 0.5 | 4 | 0.16→0.15 | — | — | — | 3.8→3.9 | — |
| Dune | 6→6.2 | 4→4 | 0.5 | 7 | 0.15→0.15 | 38 (0.07) | 0.86→0.88 | 0.10 | 3.8→3.9 | — |
| Ember | 6.5→7 | 4.2→4.6 | 0.55 | 5 | 0.20→0.42 | 44 (0.10) | 0.82→0.76 | 0.16 | 3.8→3.5 | codebase −0.9, release −0.5 |
| Fjord | 7→5 | 3.5→8.5 | 0.65 | 5 | 0.20→0.24 | — | — | — | 3.8→3.4 | speed −0.7 |
| Granite | 5→5.2 | 6→6.2 | 0.6 | 9 | 0.22→0.24 | 30 (0.14) | 0.60→0.58 | 0.20 | 3.3→3.0 | speed −0.6, process −0.4, fun −0.3 |
| Halo | 5.5→6 | 4.8→4.4 | 0.5 | 8 | 0.14→0.12 | 36 (0.08) | 0.85→0.87 | 0.09 | 3.8→3.9 | — |
| Iris | 5→7.5 | 6→3.6 | 0.55 | 6 | 0.18→0.15 | — | — | — | 3.2→4.1 | — |
| Juno | 6→6 | 5→5.3 | 0.7 | 6 | 0.17→0.18 | 40 (0.42) | 0.76→0.74 | 0.14 | 3.6→3.5 | process −0.4, codebase −0.3 |
| Kestrel | 7→7.4 | 3.6→3.3 | 0.5 | 5 | 0.13→0.12 | 50 (0.07) | 0.88→0.91 | 0.07 | 4.1→4.2 | — |
| Lumen | 9→4.5 | 3.2→4.2 | 0.55 | 4 | 0.19→0.20 | — | — | — | 3.8→3.3 | support −0.5, autonomy −0.5 |

Juno's share of non-OKR stories moves 0.25→0.45; every other team uses 0.2.

**Work items.** Generate the teams in table order, all from the main stream. For each team and each weekday of the 220 days before the snapshot (history start = snapshot − 220 × 24 h, keeping the 18:00 time; day d starts at historyStart + d days; no rounding to midnight):

1. Draw a Poisson count with rate (items/wk at that point) ÷ 5.
2. For each item, set `createdAt` = that day + a uniform 0.3–0.7 of a day.
3. Draw a log-normal wait (team median, sigma 0.8). `startedAt` = created + wait.
4. Draw a log-normal cycle time (median taken at the start date, team sigma, at least 0.2 days). `doneAt` = started + cycle.
5. Pick the type from a uniform roll: below the bug share at the start date → bug; below that + 0.15 → task; otherwise story.
6. Summary: a template for the type with a random noun. Nouns: checkout, profile, wallet, login, notifications, search, limits, bonus, history, settings.
7. Story points: stories 1, 2, 3, 5 or 8; bugs 1, 2 or 3; tasks none.
8. A story joins one of its value stream's initiatives with chance 0.7.
9. Key = board key + running number from 1001. A start or done date after the snapshot is set to null.

**Work category** (category stream):

- 5% of items → None.
- Otherwise, bug → Keep the lights on.
- Task → Keep the lights on (55%), L&D (25%) or Non-OKR aligned (20%).
- Story → Non-OKR aligned with the team's non-OKR chance, else OKR aligned.

**Sprints** (Scrum teams, main stream, after all work items):

- 13 two-week sprints, numbered 41–53, named "\<Team> Sprint \<n>". The last one ends 2 days before the snapshot.
- Committed = velocity × (1 + noise × normal), at least 8.
- Say/Do = the profile value at that point + 0.05 × normal, kept within 0.3–1.
- Added = committed × (scope change + 0.06 × normal), at least 0.
- Completed committed = committed × Say/Do. Completed added = added × a uniform 0.4–0.9. Removed = committed × a uniform 0–0.08.
- Goal met with chance 0.85 if Say/Do ≥ 0.8, 0.5 if ≥ 0.65, else 0.2.

**Pulse checks** (pulse stream):

- 7 per team, every 28 days. The latest is 5 days before the snapshot.
- 5–9 respondents.
- Each dimension = base at that point + offset × (0.3 + 0.7 × t) + 0.25 × normal, kept within 1–5 and rounded to 0.1. The offsets build up over time, so problems emerge rather than being there from the start.

## 7. App shell, filters and navigation

Every page sits inside the same shell: a dark sidebar on the left, a sticky top bar, the dummy-data banner, and a centred content area at most 1,440 px wide.

**Sidebar** (260 px, or 80 px collapsed showing icons only; it becomes a slide-over drawer on mobile):

- **Header:** a square "D" logo tile, "Delta Hub", and the subtitle "Insights & Performance".
- **Delivery:** Overview (`#/`), Health index (`#/health`), Flow (`#/flow`), Quality (`#/quality`), Teams (`#/teams`).
- **KPI Playbook:** Metric catalogue (`#/metrics`).
- **Coming next:** Engineering (DORA), Service & Ops, Risk & Security, Finance. These are dimmed with a lock icon and open a "coming soon" page (`#/coming/<id>`).
- **Footer:** Data sources (`#/data`) and "Collapse sidebar".
- **Active item:** a 4 px light left border and a lighter background.

Old links still resolve: `#/predictability` opens Health index, and `#/squads` and `#/squads/<id>` open the Teams pages. Scroll to the top on every page change. An unknown path shows "Page not found".

**Top bar** (64 px, sticky, translucent white):

- "Jump to team…" search: a text box with team-name suggestions. An exact name opens that team's page.
- "Viewing" scope dropdown, with the groups in this order: All Areas · Domain · Delivery Lead · Team · Pod. The Pod group shows only when the dataset has pods.
- Period toggle: 30d · 90d · 180d.
- A help icon linking to the Metric catalogue, and a round "JA" avatar labelled "Signed in (demo)".

**Scope.** The scope is one of: all, domain, Delivery Lead, team or pod, each with an id except "all". It filters the teams on every page. The page subtitle names the scope:

- all → "Global Platforms";
- domain → its name;
- Delivery Lead → "\<name>'s teams";
- pod → "\<name> pod";
- team → its name.

Scope and period are saved in the browser (local storage), so a reload keeps them. Team type is never a global filter: only the Teams list has its own All · Scrum · Kanban toggle, which is not saved.

**Banner.** For dummy data, a thin amber strip under the top bar reads "Proof of concept · dummy data generated for demonstration · snapshot 2 Oct 2026".

## 8. Pages

Each page opens with a header: a title, plus a subtitle of the form "\<scope> · \<question the page answers> · last N days". An empty scope shows "No teams in this scope".

**Shared building blocks.**

- **KPI tile:**
  - Uppercase label with an info icon (tooltip = the metric's description) and an icon at the top right.
  - The value in large type with its unit small.
  - A sparkline of the metric's trend.
  - A delta chip (arrow + change) followed by "vs prev. 90d".
  - A status badge.
  - An optional footer.
  - A tile with a link target is clickable as a whole.
- **Delta chip:** up, down or flat arrow, green if better, red if worse, grey if neutral, plus hidden screen-reader text ("down, better").
- **Status badge:** On track (green, check icon), Watch (amber, warning icon), Needs attention (red, error icon), each a tinted pill.
- **Sortable table:** click a header to sort; header tooltips explain each column.
- **Segmented toggle:** for team type and similar choices.
- **Empty state.**
- **Team avatar:** a coloured tile with the team's first letter.

### Overview (`#/`)

Title "Delivery overview". Subtitle: "\<scope> · 12 teams (8 Scrum, 4 Kanban) · last 90 days".

1. **Four KPI tiles:**
   - **Health index:** links to Health index. Footer: "7 of 12 teams score 80+ · 0 below 50", counting each team by its own Health index (not by the team health signal, which the Signals card counts, so the two can differ); for one team, a line naming the inputs.
   - **Pulse check:** the footer lists the biggest rise and the biggest fall by dimension (label, delta chip, current score), then "Biggest rise and fall by dimension · change vs prev. 90d".
   - **Lead time (85th pct):** footer "Of which in progress (cycle time, 85th pct): 8.0d".
   - **Development categories:**
     - headline "50% OKR aligned";
     - a stacked bar of the 5 categories (None in neutral grey);
     - a row per category with its delta in pp and its share;
     - whole-number percentages that always add up to exactly 100 (largest-remainder rounding);
     - caption "Share of items finished · change vs prev. 90d".
2. **Highlights carousel** (2 columns wide, tagged "Experiment"):
   - Up to 3 stories, rotating every 8 s; hover pauses; previous, pause and next buttons; a "1 / 3" counter.
   - Each story has a badge (Heads-up, Target met, Big improvement), the team, a headline, a body and an italic coaching prompt.
   - A side panel shows "old value → new value" and a trend over about 6 months.
   - Rules are below.
3. **Signals at a glance:**
   - Counts of teams per signal (Needs attention, Watch, On track).
   - Clicking one filters the matrix below and scrolls to it.
   - A note links to the metric catalogue.
4. **Team health matrix:**
   - **Columns:** Team (avatar, name, "domain · Delivery Lead"), Signal (tooltip lists the metrics behind it), Health index, Completion ratio, Cycle time, Stability, Scope volatility, Forecasting accuracy (sub-label "2-wk forecasts met").
   - Scrum-only cells show "—" for Kanban teams. Stability is velocity variability for Scrum and throughput variability for Kanban.
   - Each cell is coloured by its status.
   - Default sort: worst signal first. A row click opens the team.
   - "Export CSV" downloads team, domain, Delivery Lead, pod, team type, signal and the column values.
   - Hidden when the scope is a single team.
5. **Actionable insights:**
   - Up to 6 rule-based cards in a grid, each with a tone (Needs attention, Watch, Positive), a title, a body, a coaching prompt and "Open team →".
   - A header count reads "N signals · rule-based".

**Insight rules** (per team, current vs previous window, sorted attention → watch → positive):

| Condition | Tone | Title |
| --- | --- | --- |
| Scrum, scope change > 25% and Say/Do < 75% | attention | \<team>: added scope is eroding commitments |
| else Scrum, Say/Do < 65% | attention | \<team>: commitments consistently out of reach |
| cycle p85 up > 30% | attention if > 15d, else watch | \<team>: flow is slowing down |
| cycle p85 down > 20% | positive | \<team>: faster flow |
| bug ratio > 30% and up > 5 pp | attention | \<team>: more capacity going to bugs |
| throughput down > 25% | watch | \<team>: throughput dropped |
| Scrum, velocity variability > 30% | watch | \<team>: velocity is hard to forecast |
| Scrum, Say/Do ≥ 85% from < 82% | positive | \<team>: reliability improving |

The bodies quote the numbers, for example "30% of the commitment was added mid-sprint and Say/Do is 68%". Each prompt is a coaching question, for example "Where is the added work coming from — and could it wait for the next planning?"

**Highlight rules.**

- **Candidates:** for each team, its health index inputs and signal metrics that have thresholds.
- **Delta:** the score (0–100) now minus the score in the previous window.
- **Kinds:**
  - drop = the score fell by ≥ 20 points, or the status got worse;
  - milestone = now On track and was not;
  - rise = the score gained ≥ 25 points.
- **Picking:** take the biggest drop, then the biggest win (milestones count +10 when ranking), then the larger of the next drop and next win, preferring different teams.
- **No comparison:** skip highlights when the previous window starts before the data begins.
- **Wording:** as in "Borealis: pulse check fell to 3.2" / "Down from 3.7 in the previous 90 days — now needs attention." Each metric has its own prompt.

### Health index (`#/health`)

Subtitle "… · can we forecast what we will deliver? · …". A Scrum (8) | Kanban (4) toggle at the top right switches between the two sections.

- **Scrum teams section:**
  - Five KPI boxes: Cycle time (85th pct), Completion ratio, Stability, Scope volatility, Forecasting accuracy.
  - Under them, one trend chart per box. Each chart has:
    - a dashed target line at the On-track threshold;
    - the subtitle "Higher/Lower is better · \<window text>", e.g. "trailing 4-week windows, every 2 weeks";
    - a y-axis scaled to the data and target (× 1.15, capped at 100% for percentages).
  - A lone last chart spans the full width.
  - For a single team, add a "Committed vs completed" bar chart per sprint (Committed, Completed of committed, Added mid-sprint; tooltip shows Say/Do, velocity and goal met).
  - A "Scrum team breakdown" table: team, Say/Do, a sparkline of the last 8 sprints, scope change, velocity variability, goal hit rate, Say/Do signal.
- **Kanban teams section:**
  - Three boxes: Cycle time (85th pct), Stability, Forecasting accuracy.
  - Their trend charts.
  - A short explanation that Kanban predictability is read from throughput stability.
  - A "Kanban team breakdown" table with a weekly throughput sparkline and a signal.

### Flow (`#/flow`)

Subtitle question: "how smoothly does work move from started to done?"

- **KPI tiles:** Cycle time 50th pct, Cycle time 85th pct (with trend), Throughput, "Ageing WIP (N in progress)".
- **Cycle time scatter:**
  - One dot per finished item: x = done date, y = cycle days.
  - Dashed reference lines at the 50th and 85th percentiles.
  - The tooltip shows the key, summary and finished date.
- **Weekly throughput:** bar chart with an average line.
- **Cycle time distribution:** histogram, with tooltip share.
- **"Work in progress, oldest first" table:**
  - Columns: item key, summary, team, type, age (days), "vs team p85" as a multiple, with items above 1× flagged.
  - An export button.

### Quality (`#/quality`)

Subtitle question: "how much capacity goes to fixing rather than building?"

- **Tiles:**
  - Bug ratio (KPI with trend);
  - Bugs raised;
  - Bugs resolved;
  - Net bug backlog change (raised − resolved).
  - Each tile has a delta "vs prev. period".
- **Bug ratio trend:** line, rolling 4 weeks, with the target "Healthy ≤ 20%".
- **Bugs raised vs resolved per week:** grouped bars (raised orange, resolved blue).
- **"Quality by team" table:** team, bug ratio, raised, resolved, net, signal.

### Teams (`#/teams`) and team detail (`#/teams/<id>`)

**List:** title "Teams", the local All · Scrum · Kanban toggle, and the team matrix titled "All teams".

**Detail:**

- **Header:**
  - Avatar, name, team-type tag and signal badge.
  - Subtitle "\<domain> · \<value stream> · Delivery Lead: \<name> · \<pod> pod · Board \<key> · last 90 days".
  - A "← All teams" link.
  - A "Make this my view" button: sets the scope to this team; it then reads "Back to all teams view".
- **KPI tiles:**
  - Scrum: Say/Do (trend), Cycle time p85 (trend), Avg velocity, Bug ratio.
  - Kanban: Throughput variability (trend), Cycle time p85, Throughput, Bug ratio.
- **Charts:**
  - Scrum: "Sprints: committed vs completed" bars.
  - Kanban: weekly throughput.
  - Both: a cycle time p85 trend (target 10d), a cycle time scatter, and a work-in-progress table against this team's p85.
- **"Where the work went":** finished items by initiative.
- **Scrum "Sprint history" table:** sprint, ended, committed, added, velocity, Say/Do, goal.
- **Insights:** the panel titled "Conversation starters".

### Metric catalogue (`#/metrics`)

Subtitle: "The KPI Playbook, live: every number in the portal is defined here — meaning, formula, data source and thresholds."

Metrics are grouped by category: Health, Predictability, Flow, Quality, Investment, Forecast. Each card shows:

- name, team-type tags and direction;
- description;
- formula, source, and signal thresholds (or "Context" when there are none);
- the caveat.

### Data sources (`#/data`)

- **Active source:** its name, the snapshot date, and whether it is dummy data.
- **Adapters,** each with a status:
  - Dummy data: "Live in POC".
  - eazyBI snapshot: "Next".
  - Jira changelog (direct): "Later".
- **"Target pipeline" diagram:** eazyBI / Jira → extraction → canonical snapshot → portal. Only the extraction step changes when eazyBI is retired.

### Coming soon (`#/coming/<id>`)

Each page shows a title, its current maturity, the candidate metrics and a note.

| Page | Maturity | Candidate metrics |
| --- | --- | --- |
| Engineering (DORA) | Not tracked yet | Deployment frequency, Lead time for changes, Change failure rate, Failed deployment recovery time, PR review time |
| Service & Ops | Scattered across tools | Incident volume by severity, MTTA / MTTR, SLO attainment, Toil share |
| Risk & Security | To be scoped | Vulnerability age by severity, Overdue security actions, Audit findings open |
| Finance | No metrics yet | Capitalisable vs operational effort, Spend by initiative, Cost per value stream |

### Insight panel (on every page)

A dark pill button at the bottom right reads "Insight about this page". It opens a 420 px panel:

- **Header:** "Preview · example answers, no model connected".
- **Suggestions:** "Summarise this page in 3 points", "What needs attention, and why?", "Which questions should I take to the teams?"
- **Question box:** Enter sends.
- **Answers:** after about 0.9 s of "Reading the page…", an example answer appears, built from the insight rules for the current scope.
  - Questions about teams or questions to ask get the coaching prompts as bullets.
  - Anything else gets "For \<scope> over the last N days, X signals need attention. The main points:" plus the top 3 insights.
- **Reset:** the conversation clears on page change, and a bin icon starts over.
- **No model:** it never calls an AI model.

## 9. Design system

The style is called "Precision Enterprise":

- Inter font; tabular numbers everywhere.
- A near-black slate primary.
- White cards with a 1 px border and no shadow (the Insight panel is the one exception), 4 px radius on controls, 8 px on cards.
- A dark sidebar with a light left accent bar on the active item.

Status colours are reserved for state, and always come with an icon and a label.

**Colours.**

| Token | Hex | Use |
| --- | --- | --- |
| primary | #091426 | Sidebar, primary buttons |
| primary-container | #1e293b | Selected toggle, hover |
| on-primary-container | #8590a6 | Sidebar text |
| primary-fixed | #d8e3fb | Active sidebar text |
| on-primary-fixed-variant | #3c475a | Sidebar separators (at 40% opacity), active item background |
| secondary-fixed | #d5e3fd | Logo tile, avatar, accents |
| surface | #f7f9fb | Page background |
| surface-container-lowest | #ffffff | Cards |
| surface-container-low / container / high | #f2f4f6 / #eceef0 / #e6e8ea | Hovers, panels |
| on-surface / on-surface-variant | #191c1e / #45474c | Text / secondary text |
| outline / outline-variant | #75777d / #c5c6cd | Icons / borders |
| good (bg, border) | #059669 (#ecfdf5, #a7f3d0) | On track |
| warn (dot, bg, border) | #b45309 (#f59e0b, #fffbeb, #fde68a) | Watch; dummy-data banner |
| bad (dot, bg, border) | #b91c1c (#ef4444, #fef2f2, #fecaca) | Needs attention |
| series 1–4 | #2a78d6, #eb6834, #1baf7a, #eda100 | Chart series, in this order |
| chart neutral | #b4b7bd | "None" category |
| chart grid / axis / text | #e6e8ea / #75777d / #45474c | Chart furniture |

**Type scale.**

| Style | Size / line height | Weight |
| --- | --- | --- |
| display-lg (KPI values) | 36 / 44, tracking −2% | 700 |
| headline-md (page titles) | 24 / 32, tracking −1% | 600 |
| headline-sm | 20 / 28 | 600 |
| title-lg (card titles) | 18 / 24 | 600 |
| body-md / body-sm | 16 / 24, 14 / 20 | 400 |
| label-md (uppercase labels) | 12 / 16, tracking 5% | 600 |
| label-sm | 11 / 14 | 500 |

**Charts.**

- Hand-written SVG, at 240 px tall by default and full width (they measure their container).
- 2 px lines, a quiet grid and one y-axis with about 4 ticks.
- A hover tooltip on every chart, and a legend whenever there are 2 or more series or a target line.
- Bars have rounded tops. Target and reference lines are dashed grey.
- Kinds: line (optional area fill, target line), bar (grouped series, reference line, extra tooltip rows), scatter (dated x-axis, dashed reference lines) and sparkline (decorative, 96 × 32).

**Layout.**

- Grids of 1 column on mobile, 2 on medium screens and 4 on wide ones, with 20 px gaps and 32 px between sections.
- At phone width nothing scrolls sideways, and tables scroll inside their card.
- Visible focus rings.
- Animations respect the reduced-motion setting.

## 10. Real data via eazyBI exports

Real data arrives as two CSV exports from eazyBI (Cloud) plus a hand-written team list. A command (`npm run snapshot`) converts them into one snapshot JSON in the dataset format. The app then loads that file when `VITE_DATA_SOURCE=eazybi` and `VITE_SNAPSHOT_URL=./data/snapshot.json` are set in a local env file.

**Data safety.** The folders holding exports (`eazybi-data/`) and snapshots (`public/data/`) are git-ignored. The converter's summary prints counts and column names only, never cell values; a `--verbose` flag adds team names and is for local use only. Errors name the file, row and column, never the value (except dates, to show the format).

**Report 1, Issues** (`issues.csv`, one row per issue; leave out epics and sub-tasks):

| Default column | Meaning | Required |
| --- | --- | --- |
| Issue | "KEY-123 Summary" | yes |
| Issue type | Story, Bug, Task… | yes |
| Issue created date |  | yes |
| First in progress date | a calculated measure: the earliest transition into any in-progress status | yes |
| Issue resolution date | blank if not done | yes |
| Issue Story Points |  | yes |
| Issue Epic Link | becomes the initiative | no |
| a work category field | OKR aligned, Non-OKR aligned, Keep the lights on, L&D | no |

**Report 2, Sprints** (`sprints.csv`, one row per closed sprint): Sprint, Board (optional), Sprint start date, Sprint end date, Sprint Story Points committed, added, removed, completed, completed of committed (optional), and a goal-met Yes/No column (optional).

**Team list** (`squads.json`, written by hand). Per team:

- name, teamType, domain, and optional valueStream, deliveryLead and pod;
- issueMatch: by default the Jira project keys taken from the issue keys;
- sprintMatch: board names, or sprint-name prefixes when there is no Board column.

Domains, value streams, Delivery Leads and pods are built from these names. Optionally, `columns.json` overrides column names, the type map and the category map.

**Conversion rules.**

- **Dates:** accept yyyy-mm-dd, yyyy-mm-dd hh:mm(:ss), dd/mm/yyyy and ISO.
- **Issue type:** epics and sub-tasks are dropped. Story, bug and task map to themselves; anything else becomes task.
- **Category:** matching ignores case. Values such as "okr aligned", "non-okr", "ktlo", "keep the lights on", "l&d" and "learning" map to their category. A blank becomes None; an unknown value also becomes None and is counted.
- **Not yet done:** a missing done date means not done yet.
- **Completed of committed:** when missing, estimate it as min(completed, committed − removed).
- **Goal met:** null unless the column exists.
- **Unmatched rows:** issues and sprints that match no team are counted and left out.
- **Snapshot date:** defaults to now; a `--as-of` flag overrides it.
- **Pulse checks:** eazyBI has none, so the pulse is empty and the health index uses its other inputs.
- **Summary:** rows used vs total, excluded by type, unmatched, without a start date, not done, without points, and teams by type.

**Sample.** `npm run snapshot:sample` writes fictional exports made from the dummy data and converts them. A test checks that this round trip reproduces the dummy dataset's metrics to 4 decimals.

## 11. Build steps and acceptance checks

Build in this order. Each step should leave the app running, with the type check and tests passing.

The reference numbers come from the original at the 90-day period and All Areas scope. A rebuild that draws random numbers in a different order lands near them, not on them. Treat them as ranges: within about 15% of each value, and with the same teams flagged.

| Step | Build | Done when |
| --- | --- | --- |
| 1. Skeleton | Vite + React + TypeScript + Tailwind; design tokens (section 9); hash router; app shell with sidebar, top bar and banner; empty pages for every route | All sidebar links open their page; collapse works; layout holds at phone width |
| 2. Data | Data model (section 3), seeded random generator, dummy-data generator (section 6), data context, source switch | 12 teams, about 2,400 items, 104 sprints (8 × 13), 84 pulses; same values on every reload |
| 3. Metrics | Stats, periods, every metric in section 5, scores, health index, team signal, scorecard with memo, trends; unit tests for each | Tests cover percentile, CV, Say/Do pooling, the scoring anchors (100 / 50 / 0), the 3-input minimum, forecast determinism, and that pulses under 3 respondents are hidden |
| 4. Filters and kit | Scope and period with saved state; KPI tile, delta chip, status badge, sortable table, toggle; the 4 chart kinds | Changing scope or period updates the subtitle; a reload keeps them; Pod groups list the 5 pods |
| 5. Overview | The 4 tiles, highlights carousel, signals card, team matrix with CSV, insights panel (section 8) | Health index about 86/100, "7 of 12 teams score 80+ · 0 below 50" (at 90d); pulse about 3.6; lead time p85 about 20d; OKR aligned about 50%, with categories adding up to 100%; Borealis, Granite and Fjord among the first insights |
| 6. Health index, Flow, Quality | The three pages as in section 8 | Scrum boxes: cycle p85 about 8d, completion about 79% (Watch), stability about 11%, scope volatility about 14%, forecasting accuracy about 90%; the Kanban toggle shows 4 teams; Fjord gets the "flow is slowing down" insight; Ember has the highest bug ratio (about 33%) |
| 7. Teams and the rest | Teams list and detail, Metric catalogue, Data sources, Coming soon, Insight panel preview | Granite shows Needs attention with Say/Do about 59%; "Make this my view" sets the scope; the catalogue lists all 18 metrics; the Insight panel answers with example text |
| 8. eazyBI path | Converter command, sample exports, env switch (section 10) | The sample round trip matches the dummy metrics; the summary shows counts only; with the env set, Data sources says "eazyBI snapshot" |

After step 8, keep the `CLAUDE.md` up to date with the principles in section 1 and the commands to run. Do this before connecting any real data.
