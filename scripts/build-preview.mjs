#!/usr/bin/env node
/**
 * Single-file build: bundles the app with esbuild, compiles Tailwind v4 programmatically,
 * and inlines both into dist-single/index.html — one file you can email, host anywhere,
 * or open from disk. (The normal dev/prod flow is Vite: `npm run dev` / `npm run build`.)
 */
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const out = path.join(root, 'dist-single');

// 1. JS bundle (CSS import is stripped — Tailwind is compiled separately below)
const js = await build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  target: 'es2020',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: {
    'import.meta.env': JSON.stringify({ VITE_DATA_SOURCE: process.env.VITE_DATA_SOURCE ?? 'mock', MODE: 'production' }),
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'warning',
});
const bundle = js.outputFiles[0].text;

// 2. Tailwind: collect candidate class tokens from source, then compile
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|html)$/.test(e.name) ? [p] : [];
  });
const candidates = new Set();
for (const file of walk(path.join(root, 'src'))) {
  for (const tok of fs.readFileSync(file, 'utf8').split(/[\s"'`{}<>;=]+/)) if (tok) candidates.add(tok);
}
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const compiler = await compile(fs.readFileSync(path.join(root, 'src/index.css'), 'utf8'), {
  base: root,
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12)) : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});
const css = compiler.build([...candidates]);

// 3. Inline into the HTML shell
const html = fs
  .readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script type="module" src="[^"]+"><\/script>/, () => `<script type="module">${bundle.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace('</head>', () => `<style>${css}</style>\n  </head>`);

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);

// Fragment variant (no <html>/<head>/<body> wrapper) for hosts that supply their own skeleton
const fragment = html
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '')
  .replace(/<meta charset[^>]*>\s*<meta name="viewport"[^>]*>/i, '')
  .replace(/<\/head>\s*<body>/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '')
  .replace('<style>', '<style>:root{color-scheme:light}');
fs.writeFileSync(path.join(out, 'fragment.html'), fragment);
console.log(`dist-single/index.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(bundle.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`);
