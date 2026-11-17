#!/usr/bin/env node
// Writes the README index table from website/sidebars.ts: one row per sidebar
// section, linked to that section's first page. Run through `npm run gen`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..');
const repo = path.resolve(site, '..');
const docs = path.join(repo, 'docs');
const readmePath = path.join(repo, 'README.md');
const base = 'https://managingwp.github.io/gridpane-nginx-marketing-params';
const begin = '<!-- BEGIN docs-index -->';
const end = '<!-- END docs-index -->';

const fail = (message) => {
  console.error(`gen-readme-index: ${message}`);
  process.exit(1);
};

const sidebars = fs.readFileSync(path.join(site, 'sidebars.ts'), 'utf8');
const category = /\{\s*type:\s*'category',\s*label:\s*'([^']+)',\s*items:\s*\[([^\]]*)\]/g;

const rows = [['Overview', `${base}/`]];
for (const match of sidebars.matchAll(category)) {
  const label = match[1];
  const ids = [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const first = ids.find((id) => fs.existsSync(path.join(docs, `${id}.md`)));
  if (!first) fail(`sidebar section "${label}" resolves to no page under docs/`);
  rows.push([label, `${base}/${first}`]);
}

if (rows.length < 2) fail('no sidebar sections found in sidebars.ts');

const table = [
  '| Section | Link |',
  '|---------|------|',
  ...rows.map(([label, url]) => `| ${label} | ${url} |`),
].join('\n');

const readme = fs.readFileSync(readmePath, 'utf8');
const block = new RegExp(`${begin}[\\s\\S]*?${end}`);
if (!block.test(readme)) fail(`README.md has no ${begin} … ${end} block`);

fs.writeFileSync(
  readmePath,
  readme.replace(block, `${begin}\n${table}\n${end}`),
);
console.log(`wrote ${rows.length} rows to README.md`);
