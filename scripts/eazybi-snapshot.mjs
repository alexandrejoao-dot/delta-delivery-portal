#!/usr/bin/env node
/**
 * eazyBI exports → portal snapshot.
 *
 *   npm run snapshot           reads eazybi-data/ and writes public/data/snapshot.json
 *   npm run snapshot:sample    writes fictional example exports to eazybi-data.example/ and converts them
 *
 * Both folders with real data (eazybi-data/, public/data/) are git-ignored: the exports never leave the machine.
 * The printed summary has counts only — no issue keys, names or values — unless you pass --verbose.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sample = args.includes('--sample');
const verbose = args.includes('--verbose');
const inDir = path.join(root, sample ? 'eazybi-data.example' : 'eazybi-data');
const outFile = path.join(root, 'public/data/snapshot.json');

// The converter is TypeScript shared with the app and its tests — bundle it on the fly
const bundled = await build({
  stdin: {
    contents: `export * from './src/data/sources/eazybi/convert.ts'; export * from './src/data/sources/eazybi/sample.ts'; export { generateDataset } from './src/data/sources/mock/generator.ts';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
});
const tmp = path.join(root, 'node_modules/.cache/eazybi-convert.mjs');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, bundled.outputFiles[0].text);
const lib = await import(pathToFileURL(tmp).href);

if (sample) {
  const { issuesCsv, sprintsCsv, squads } = lib.toEazybiExports(lib.generateDataset());
  fs.mkdirSync(inDir, { recursive: true });
  fs.writeFileSync(path.join(inDir, 'issues.csv'), issuesCsv);
  fs.writeFileSync(path.join(inDir, 'sprints.csv'), sprintsCsv);
  fs.writeFileSync(path.join(inDir, 'squads.json'), JSON.stringify({ squads }, null, 2) + '\n');
  fs.writeFileSync(path.join(inDir, 'columns.json'), JSON.stringify(lib.SAMPLE_COLUMNS, null, 2) + '\n');
  console.log(`Wrote fictional example exports to ${path.relative(root, inDir)}/`);
}

const read = (name, required = true) => {
  const f = path.join(inDir, name);
  if (!fs.existsSync(f)) {
    if (!required) return null;
    console.error(`Missing ${path.relative(root, f)} — see docs/eazybi-reports.md for what goes in ${path.relative(root, inDir)}/.`);
    process.exit(1);
  }
  return fs.readFileSync(f, 'utf8');
};
const readJson = (name, required) => {
  const text = read(name, required);
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`${name} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
};

const asOfArg = args.find((a) => a.startsWith('--as-of='))?.slice(8);
let result;
try {
  result = lib.convertEazybi({
    issuesCsv: read('issues.csv'),
    sprintsCsv: read('sprints.csv'),
    squads: readJson('squads.json', true).squads,
    columns: readJson('columns.json', false),
    // The sample is generated relative to the mock snapshot date; real exports default to now
    asOf: asOfArg ? new Date(asOfArg).toISOString() : sample ? lib.generateDataset().asOf : undefined,
  });
} catch (e) {
  if (e instanceof lib.ConvertError) {
    console.error(`\nCould not convert:\n  ${e.message}\n`);
    process.exit(1);
  }
  throw e;
}

const { dataset, summary: s } = result;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(dataset));

const pct = (n, of) => (of ? `${Math.round((n / of) * 100)}%` : '—');
console.log(`
Snapshot written to ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB), as of ${s.asOf.slice(0, 10)}

Issues   ${s.issues.rows} rows → ${s.issues.used} used
         ${s.issues.excludedType} excluded by type (epics, sub-tasks) · ${s.issues.noSquad} matched no squad
         ${s.issues.noStart} without a start date (${pct(s.issues.noStart, s.issues.used)}) · ${s.issues.notDone} not done yet · ${s.issues.noPoints} without story points
Sprints  ${s.sprints.rows} rows → ${s.sprints.used} used
         ${s.sprints.noSquad} matched no squad · ${s.sprints.notClosed} not closed yet
Squads   ${s.squads.length} (${s.squads.filter((q) => q.teamType === 'scrum').length} Scrum, ${s.squads.filter((q) => q.teamType === 'kanban').length} Kanban)
`);
if (verbose) {
  console.log('Per squad (local only — contains names):');
  s.squads.forEach((q) => console.log(`  ${q.name.padEnd(24)} ${q.teamType.padEnd(7)} ${String(q.issues).padStart(6)} issues ${String(q.sprints).padStart(4)} sprints`));
  if (s.unmatchedSquadValues.length) console.log(`\nSquad values with no match in squads.json: ${s.unmatchedSquadValues.join(', ')}`);
  console.log('');
}
if (s.warnings.length) console.log(`Notes:\n${s.warnings.map((w) => `  • ${w}`).join('\n')}\n`);
console.log(
  sample
    ? 'To see it: put VITE_DATA_SOURCE=eazybi and VITE_SNAPSHOT_URL=./data/snapshot.json in .env.local, then npm run dev.'
    : 'This summary has counts only and is safe to share. Run with --verbose for per-squad detail (keep that local).',
);
