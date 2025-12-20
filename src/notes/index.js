// Notes storage: prefer local project filesystem via dev server API (/api/notes)
// Fallback to localStorage when API is unavailable (e.g., production static deploy)
const STORAGE_KEY = 'skyrim_notes_v1';

// simple frontmatter parser (client-side). Supports title and nodeIds as JSON array or quoted string.
function parseFrontmatter(text) {
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
    if (val.startsWith('[') && val.endsWith(']')) {
      try { meta[key] = JSON.parse(val); continue; } catch (e) {}
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      meta[key] = val.slice(1, -1);
      continue;
    }
    meta[key] = val;
  }
  return { meta, content: rest };
}

// simple in-memory cache for parsed note frontmatter to reduce repeated fetches during session
const noteMetaCache = new Map();

async function apiAvailable() {
  try {
    const res = await fetch('/api/notes', { method: 'HEAD' });
    const ct = res.headers.get('content-type') || '';
    // Consider API available only if it returns JSON-like content
    return res.ok && ct.includes('application/json');
  } catch (e) {
    return false;
  }
}

function nowTs() { return new Date().toISOString(); }

function loadNotesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('notes: loadNotesLocal error', e);
    return [];
  }
}

function saveNotesLocal(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch (e) {
    console.error('notes: saveNotesLocal error', e);
    return false;
  }
}

// Public API now async-aware
async function loadNotes() {
  if (await apiAvailable()) {
    const res = await fetch('/api/notes');
    const list = await res.json();
    // Map to our internal shape (id,title,content optional)
    return list.map(i => ({ id: i.id, title: i.title || i.filename, content: null, nodeIds: i.nodeIds || [], createdAt: i.createdAt, updatedAt: i.updatedAt }));
  }

  // Try to read a static manifest under /note/notes.json (served by Vite as static file)
  try {
    const m = await fetch('/note/notes.json');
    if (m.ok) {
      const list = await m.json();
      return list.map(i => ({ id: i.id, title: i.title || i.filename, content: null }));
    }
  } catch (e) {
    // ignore
  }

  return loadNotesLocal();
}

async function saveNotes(notes) {
  if (await apiAvailable()) {
    // no bulk save API; fall back to localStorage
    return saveNotesLocal(notes);
  }
  return saveNotesLocal(notes);
}

async function createNote({ title = '', content = '', nodeIds = [] } = {}) {
  if (await apiAvailable()) {
    const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) });
    const info = await res.json();
    return { id: info.id, title: title || info.id, content, nodeIds, createdAt: info.createdAt, updatedAt: info.updatedAt };
  }
  // fallback local
  const notes = loadNotesLocal();
  const id = `note_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const note = { id, title: title || '未命名笔记', content, nodeIds, createdAt: nowTs(), updatedAt: nowTs() };
  notes.unshift(note);
  saveNotesLocal(notes);
  return note;
}

async function updateNote(id, patch = {}) {
  if (await apiAvailable()) {
    const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: patch.content || '' }) });
    if (!res.ok) return null;
    const info = await res.json();
    return { id, ...patch, updatedAt: info.updatedAt };
  }
  const notes = loadNotesLocal();
  const i = notes.findIndex(n => n.id === id);
  if (i === -1) return null;
  notes[i] = { ...notes[i], ...patch, updatedAt: nowTs() };
  saveNotesLocal(notes);
  return notes[i];
}

async function deleteNote(id) {
  if (await apiAvailable()) {
    await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  }
  const notes = loadNotesLocal();
  const next = notes.filter(n => n.id !== id);
  saveNotesLocal(next);
  return true;
}

async function getNote(id) {
  if (await apiAvailable()) {
    const res = await fetch(`/api/notes/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, title: data.filename.replace(/\.md$/, ''), content: data.content, createdAt: data.createdAt, updatedAt: data.updatedAt };
  }

  // Try static file under /note/<id>.md
  try {
    const r = await fetch(`/note/${encodeURIComponent(id)}.md`);
    if (r.ok) {
      const raw = await r.text();
      const pf = parseFrontmatter(raw);
      const meta = pf.meta || {};
      const nodeIds = Array.isArray(meta.nodeIds) ? meta.nodeIds : (meta.nodeIds ? [meta.nodeIds] : []);
      const title = meta.title || id;
      // cache meta
      noteMetaCache.set(id, { title, nodeIds });
      return { id, title, content: pf.content, nodeIds };
    }
  } catch (e) {
    // ignore
  }

  const notes = loadNotesLocal();
  return notes.find(n => n.id === id) || null;
}

async function getNotesByNodeId(nodeId) {
  if (!nodeId) return [];
  // load list then ensure nodeIds are resolved (may require fetching frontmatter for each note)
  const notes = await loadNotes();
  const result = [];
  for (const n of notes) {
    let ids = n.nodeIds || [];
    if ((!ids || ids.length === 0) && noteMetaCache.has(n.id)) {
      ids = noteMetaCache.get(n.id).nodeIds || [];
    }
    if ((!ids || ids.length === 0)) {
      // attempt to fetch note meta
      try {
        const full = await getNote(n.id);
        if (full && Array.isArray(full.nodeIds)) {
          ids = full.nodeIds;
        }
      } catch (e) {
        // ignore
      }
    }
    if (Array.isArray(ids) && ids.includes(nodeId)) result.push(n);
  }
  return result;
}

export { loadNotes, saveNotes, createNote, updateNote, deleteNote, getNote, getNotesByNodeId };
