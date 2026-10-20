# Delta Hub (POC)

A central place for delivery metrics across Global Platforms — Overview, Predictability, Flow,
Quality, per-squad detail, and a live metric catalogue (the KPI Playbook). Runs on seeded dummy
data; the data layer is built so eazyBI can be plugged in without touching metrics or UI.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. Use **Viewing** (top bar) to switch altitude — all of Global Platforms,
a domain, a Delivery Lead's squads, or one squad — and the **30d / 90d / 180d** toggle for the period.

Other scripts: `npm test`, `npm run typecheck`, `npm run build`, `npm run build:single`
(one self-contained HTML file in `dist-single/`).

## Open in Claude Code

```bash
cd delta-delivery-portal
claude
```

`CLAUDE.md` explains the architecture, the measurement principles, and the suggested next steps
(starting with wiring eazyBI). A good first prompt:

> Read CLAUDE.md, run the tests, then plan how to implement the eazyBI snapshot adapter.

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Values | Default |
|---|---|---|
| `VITE_DATA_SOURCE` | `mock`, `eazybi` | `mock` |
| `VITE_SNAPSHOT_URL` | URL of a canonical snapshot JSON (eazyBI source) | — |
