#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function parseFrontmatter(text) {
  if (!text || !text.startsWith('---')) return { meta: {}, content: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, content: text };
  const fmRaw = text.slice(3, end + 1).trim();
  const lines = fmRaw.split(/\r?\n/);
  const meta = {};
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(/^([a-zA-Z0-9_\-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      try { meta[key] = JSON.parse(val); continue; } catch (e) {}
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      meta[key] = val.slice(1, -1);
      continue;
    }
    meta[key] = val;
  }
  return { meta };
}

const notesDir = path.resolve(process.cwd(), 'note');
if (!fs.existsSync(notesDir)) {
  console.error('note/ directory not found');
  process.exit(1);
}

const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'));
const list = files.map(f => {
  const full = path.join(notesDir, f);
  const raw = fs.readFileSync(full, 'utf8');
  const pf = parseFrontmatter(raw);
  const fm = pf.meta || {};
  const title = fm.title || f.replace(/\.md$/, '');
  const nodeIds = Array.isArray(fm.nodeIds) ? fm.nodeIds : (fm.nodeIds ? [fm.nodeIds] : []);
  return { id: f.replace(/\.md$/, ''), filename: f, title, nodeIds };
});

const out = path.join(notesDir, 'notes.json');
fs.writeFileSync(out, JSON.stringify(list, null, 2), 'utf8');
console.log('Wrote', out);
