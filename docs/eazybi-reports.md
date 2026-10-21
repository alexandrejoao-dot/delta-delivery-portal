# Real data from eazyBI (Cloud)

The portal reads one snapshot file in its own format. `npm run snapshot` builds that file from two
eazyBI CSV exports plus a squad list you write by hand. Everything happens on the company computer:

```
eazyBI ──export CSV──▶ eazybi-data/ ──npm run snapshot──▶ public/data/snapshot.json ──▶ npm run dev
                       (git-ignored)                      (git-ignored)
```

**Data safety.** `eazybi-data/` and `public/data/` are in `.gitignore`, so `git add -A` / `git push`
never send them anywhere. The summary `npm run snapshot` prints has counts only and is safe to
share; `--verbose` adds squad names — keep that local. Don't open the exports with an AI tool unless
the company has approved it for internal data.

## 1. Before you start

- eazyBI must import **issue change history** (Source data → Jira import options → "Import issue
  change history"). Without it there are no transition dates, so no cycle time.
- Story points must be imported as a measure/property (usually already the case).

## 2. Report 1 — Issues (`eazybi-data/issues.csv`)

One row per issue. In **Analyze**, create a report:

- **Rows:** Issue dimension, at **Issue** level. Filter it to your squads' projects (or boards), and to
  issues resolved in roughly the last 9 months plus unresolved ones. Leave out epics and sub-tasks if
  you can (the converter drops them anyway).
- **Columns** (issue properties and measures):

| Column (default name) | What it is | Required |
|---|---|---|
| `Issue` | eazyBI's issue name, "KEY-123 Summary" — always the first column | yes |
| `Issue type` | Story / Bug / Task … | yes |
| `Issue created date` | | yes |
| `First in progress date` | calculated measure, see below | yes |
| `Issue resolution date` | when it was done (blank if not done) | yes |
| `Issue Story Points` | | yes |
| `Issue Epic Link` | epic — shown as the initiative (`Issue Parent` in newer Jira) | optional |
| a work category field or label | feature / tech debt / maintenance / defect | optional |

**`First in progress date`** — new calculated measure in Measures. Put every "in progress" status of
your workflows in the set:

```
TimestampToDate(Min(
  { [Transition Status].[In Progress], [Transition Status].[In Review] },
  DateToTimestamp([Measures].[Transition to status first date])
))
```

Format it as a date (yyyy-mm-dd is best). Name it `First in progress date`.

**Export:** report menu → Export → **CSV**. Save as `eazybi-data/issues.csv`.

## 3. Report 2 — Sprints (`eazybi-data/sprints.csv`)

One row per **closed** sprint of the Scrum squads.

- **Rows:** Sprint dimension (Board → Sprint), closed sprints of the last ~9 months.
- **Columns:**

| Column (default name) | Required |
|---|---|
| `Sprint` (sprint name) | yes |
| `Board` | optional — without it, sprints are matched on their name prefix |
| `Sprint start date` | yes |
| `Sprint end date` | yes |
| `Sprint Story Points committed` | yes |
| `Sprint Story Points added` | yes |
| `Sprint Story Points removed` | yes |
| `Sprint Story Points completed` | yes |
| `Sprint Story Points completed of committed` | optional — estimated when missing |
| a "goal met" column (Yes/No) | optional — Jira doesn't record it |

The measure names above are eazyBI's sprint scope measures as we expect them in Cloud — if yours
are named differently, keep them and put your names in `columns.json` (step 5).

**Export:** CSV → `eazybi-data/sprints.csv`.

## 4. Squad list (`eazybi-data/squads.json`)

Written by hand, once. `issueMatch` is what links issues to the squad — by default the Jira
**project key** taken from the issue key. `sprintMatch` is the board name (or the start of the
sprint names, if the export has no Board column).

```json
{
  "squads": [
    {
      "name": "Payments",
      "teamType": "scrum",
      "domain": "Commerce",
      "valueStream": "Checkout",
      "deliveryLead": "A. Lead",
      "issueMatch": ["PAY"],
      "sprintMatch": ["PAY board"]
    },
    { "name": "Search", "teamType": "kanban", "domain": "Commerce", "issueMatch": ["SRCH"] }
  ]
}
```

If several squads share one Jira project, add a column that tells them apart (a Team field, or the
board) to the issues report and point `issues.squad` at it in `columns.json`; then `issueMatch`
holds that column's values.

## 5. Column names (`eazybi-data/columns.json`, optional)

Only needed when your column names differ from the defaults above. Override just what differs:

```json
{
  "issues": { "started": "First In Progress", "epic": "Issue Parent", "category": "Work type" },
  "sprints": { "board": null, "end": "Sprint complete date" },
  "categoryMap": { "Improvement": "techDebt", "Support": "maintenance" }
}
```

## 6. Build and view

```bash
npm run snapshot
```

Then in `.env.local` (git-ignored):

```
VITE_DATA_SOURCE=eazybi
VITE_SNAPSHOT_URL=./data/snapshot.json
```

and `npm run dev` (restart it if it was running). **Data sources** in the sidebar should say
"eazyBI snapshot". Remove those two lines to go back to dummy data.

To refresh: export again, `npm run snapshot`, reload the page.

## When something doesn't fit

The converter stops with a message that names the file, row and column — never cell values (except
dates, to show the format) — so it can be shared to get help:

- *column "X" not found* → it lists the columns the file does have; set the right name in `columns.json`.
- *date in a format the converter doesn't read* → format the measure as yyyy-mm-dd in eazyBI.
- *no rows matched a squad* / many "matched no squad" → check `issueMatch` (`--verbose` lists the
  unmatched values locally).

## Try it without real data

`npm run snapshot:sample` writes fictional exports (made from the dummy data) to
`eazybi-data.example/` and converts them — the same files and steps as above.
