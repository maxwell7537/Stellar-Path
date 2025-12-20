import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { parse as parseUrl } from 'url'

// Helper to read request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Simple frontmatter parser for dev middleware (supports title, nodeIds as JSON array or YAML-like list)
function parseFrontmatterFromString(text) {
  if (!text || !text.startsWith('---')) return { meta: {}, content: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, content: text };
  const fmRaw = text.slice(3, end + 1).trim();
  const rest = text.slice(end + 4);
  const meta = {};
  const lines = fmRaw.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(/^([a-zA-Z0-9_\-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // try JSON array
    if (val.startsWith('[') && val.endsWith(']')) {
      try { meta[key] = JSON.parse(val); continue; } catch (e) {}
    }
    // quoted string
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      meta[key] = val.slice(1, -1);
      continue;
    }
    // plain value
    meta[key] = val;
  }
  return { meta, content: rest };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // 在开发服务器注入一个轻量的文件系统 API，仅在 dev 模式可用
    configureServer(server) {
      const notesDir = path.resolve(process.cwd(), 'note');
      // Ensure directory exists
      try { fs.mkdirSync(notesDir, { recursive: true }); } catch (e) {}

      // build notes.json manifest from markdown frontmatter
      function writeNotesManifest(dir) {
        try {
          const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
          const list = files.map(f => {
            const full = path.join(dir, f);
            const raw = fs.readFileSync(full, 'utf8');
            const pf = parseFrontmatterFromString(raw);
            const fm = pf.meta || {};
            const title = fm.title || f.replace(/\.md$/, '');
            const nodeIds = Array.isArray(fm.nodeIds) ? fm.nodeIds : (fm.nodeIds ? [fm.nodeIds] : []);
            return { id: f.replace(/\.md$/, ''), filename: f, title, nodeIds };
          });
          const out = path.join(dir, 'notes.json');
          fs.writeFileSync(out, JSON.stringify(list, null, 2), 'utf8');
        } catch (e) {
          // ignore errors
          console.error('writeNotesManifest error', e);
        }
      }

      // initial manifest write
      writeNotesManifest(notesDir);

      // watch for changes and rebuild manifest (debounced)
      let manifestTimer = null;
      const scheduleManifest = () => {
        if (manifestTimer) clearTimeout(manifestTimer);
        manifestTimer = setTimeout(() => writeNotesManifest(notesDir), 150);
      };

      // Prefer Vite's watcher (chokidar) if available
      try {
        if (server && server.watcher && typeof server.watcher.on === 'function') {
          server.watcher.on('add', p => { if (p.endsWith('.md') && p.indexOf(notesDir) !== -1) scheduleManifest(); });
          server.watcher.on('change', p => { if (p.endsWith('.md') && p.indexOf(notesDir) !== -1) scheduleManifest(); });
          server.watcher.on('unlink', p => { if (p.endsWith('.md') && p.indexOf(notesDir) !== -1) scheduleManifest(); });
        } else {
          // fallback to fs.watch
          try {
            fs.watch(notesDir, (ev, fname) => { if (fname && fname.endsWith('.md')) scheduleManifest(); });
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }

      server.middlewares.use(async (req, res, next) => {
        const url = parseUrl(req.url || '', true);
        if (!url.pathname || !url.pathname.startsWith('/api/notes')) return next();

        // GET /api/notes -> list files
        // GET /api/notes/:id -> get file
        // POST /api/notes -> create
        // PUT /api/notes/:id -> update
        // DELETE /api/notes/:id -> delete
        try {
          const parts = url.pathname.split('/').filter(Boolean); // ['api','notes',':id']
          if (req.method === 'GET' && parts.length === 2) {
            const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'));
            const list = files.map(f => {
              const full = path.join(notesDir, f);
              const stat = fs.statSync(full);
              const raw = fs.readFileSync(full, 'utf8');
              const pf = parseFrontmatterFromString(raw);
              const fm = pf.meta || {};
              const title = fm.title || f.replace(/\.md$/, '');
              const nodeIds = Array.isArray(fm.nodeIds) ? fm.nodeIds : (fm.nodeIds ? [fm.nodeIds] : []);
              return { id: f.replace(/\.md$/, ''), filename: f, title, nodeIds, createdAt: stat.birthtime, updatedAt: stat.mtime };
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(list));
            return;
          }

          if (req.method === 'GET' && parts.length === 3) {
            const id = parts[2];
            const file = path.join(notesDir, id + '.md');
            if (!fs.existsSync(file)) { res.statusCode = 404; res.end('Not found'); return; }
            const content = fs.readFileSync(file, 'utf8');
            const stat = fs.statSync(file);
            const pf = parseFrontmatterFromString(content);
            const fm = pf.meta || {};
            const nodeIds = Array.isArray(fm.nodeIds) ? fm.nodeIds : (fm.nodeIds ? [fm.nodeIds] : []);
            const title = fm.title || id;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id, filename: id + '.md', title, nodeIds, content: pf.content, createdAt: stat.birthtime, updatedAt: stat.mtime }));
            return;
          }

          if (req.method === 'POST' && parts.length === 2) {
            const body = await readBody(req);
            const payload = JSON.parse(body || '{}');
            const title = payload.title || `note-${Date.now()}`;
            // sanitize filename
            const fileName = title.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || `note-${Date.now()}`;
            let file = path.join(notesDir, fileName + '.md');
            // avoid overwrite
            if (fs.existsSync(file)) {
              file = path.join(notesDir, `${fileName}-${Date.now()}.md`);
            }
            fs.writeFileSync(file, payload.content || '');
            const stat = fs.statSync(file);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id: path.basename(file, '.md'), filename: path.basename(file), createdAt: stat.birthtime, updatedAt: stat.mtime }));
            return;
          }

          if ((req.method === 'PUT' || req.method === 'PATCH') && parts.length === 3) {
            const id = parts[2];
            const file = path.join(notesDir, id + '.md');
            if (!fs.existsSync(file)) { res.statusCode = 404; res.end('Not found'); return; }
            const body = await readBody(req);
            const payload = JSON.parse(body || '{}');
            fs.writeFileSync(file, payload.content || '');
            const stat = fs.statSync(file);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id, filename: id + '.md', updatedAt: stat.mtime }));
            return;
          }

          if (req.method === 'DELETE' && parts.length === 3) {
            const id = parts[2];
            const file = path.join(notesDir, id + '.md');
            if (fs.existsSync(file)) fs.unlinkSync(file);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          res.statusCode = 400; res.end('Bad request');
        } catch (err) {
          res.statusCode = 500; res.end(String(err));
        }
      });
    }
  }
})
