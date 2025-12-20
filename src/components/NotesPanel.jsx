import React, { useEffect, useState } from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { loadNotes, createNote, updateNote, deleteNote, getNotesByNodeId, getNote, setSkillNameMap } from '../notes';
import constellationRegistry from '../data';
import { useMemo } from 'react';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// NotesPanel: 左侧纵向列表，编辑时进入全屏 Markdown 编辑/预览界面
const NotesPanel = ({ visible, onClose, selectedSkill, onOpenSkillById, onPreviewChange }) => {
  const [notes, setNotes] = useState([]);
  const [editing, setEditing] = useState(null); // note id 或 'new' 表示新建，null 表示不在全屏编辑
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteNodeIds, setNoteNodeIds] = useState([]);
  const [noteNodeNames, setNoteNodeNames] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await loadNotes();
        console.log('NotesPanel: loaded notes', list);
        if (mounted) setNotes(list);
      } catch (e) {
        console.error('NotesPanel: loadNotes error', e);
        if (mounted) setNotes([]);
      }
    })();
    return () => { mounted = false; };
  }, [visible]);

  // Notify parent when preview/editor state changes so parent can hide external UI (e.g. pull-tab)
  useEffect(() => {
    try {
      if (typeof onPreviewChange === 'function') onPreviewChange(Boolean(editing));
    } catch (e) {
      console.error('NotesPanel: onPreviewChange error', e);
    }
  }, [editing, onPreviewChange]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (editing && editing !== 'new') {
        // load full note content (prefer filesystem / static file) instead of list entry which may have null content
        try {
          const full = await getNote(editing);
          if (full && mounted) {
            setTitle(full.title || full.id || '');
            setContent(full.content || '');
            return;
          }
        } catch (e) {
          console.error('NotesPanel: error loading full note', e);
        }
        // fallback to list entry
        const list = await loadNotes();
        const n = list.find(x => x.id === editing);
        if (n && mounted) {
          setTitle(n.title);
          setContent(n.content || '');
        }
      } else if (editing === 'new') {
        if (mounted) {
          setTitle(selectedSkill ? `笔记：${selectedSkill.name}` : '新笔记');
          setContent('');
        }
      } else {
        if (mounted) {
          setTitle('');
          setContent('');
        }
      }
    })();
    return () => { mounted = false; };
  }, [editing, selectedSkill]);

  const refresh = async () => {
    try {
      const list = await loadNotes();
      setNotes(list);
    } catch (e) {
      console.error('NotesPanel: refresh error', e);
    }
  };

  const handleCreateInline = () => {
    // 在侧栏快速新建后进入全屏编辑
    setEditing('new');
  };

  const handleSaveFromEditor = async () => {
    try {
      if (editing === 'new') {
        const nodeIds = selectedSkill ? [selectedSkill.id] : [];
        await createNote({ title: title || (selectedSkill ? `笔记：${selectedSkill.name}` : '未命名笔记'), content, nodeIds });
      } else if (editing) {
        await updateNote(editing, { title, content, nodeIds: selectedSkill ? [selectedSkill.id] : [] });
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      console.error('NotesPanel: save error', e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除该笔记？')) return;
    try {
      await deleteNote(id);
      if (editing === id) setEditing(null);
      await refresh();
    } catch (e) {
      console.error('NotesPanel: delete error', e);
    }
  };

  const openNoteInEditor = async (note) => {
    try {
      const n = await getNote(note.id);
      if (n) {
        setTitle(n.title || note.title || note.id);
        setContent(n.content || '');
        setNoteNodeIds(n.nodeIds || []);
        setNoteNodeNames(n.nodeNames || (n.nodeIds || []).map(id => skillNameMap.get(id) || id));
      } else {
        setTitle(note.title || note.id);
        setContent(note.content || '');
        setNoteNodeIds(note.nodeIds || []);
        setNoteNodeNames((note.nodeIds || []).map(id => skillNameMap.get(id) || id));
      }
    } catch (e) {
      console.error('NotesPanel: openNoteInEditor error', e);
      setTitle(note.title || note.id);
      setContent(note.content || '');
      setNoteNodeIds(note.nodeIds || []);
      setNoteNodeNames((note.nodeIds || []).map(id => skillNameMap.get(id) || id));
    }
    setEditing(note.id);
  };

  const openLinkedSkill = (note) => {
    const first = (note.nodeIds || [])[0];
    if (first && onOpenSkillById) onOpenSkillById(first);
  };

  const skillNameMap = useMemo(() => {
    const map = new Map();
    try {
      for (const c of constellationRegistry) {
        if (!c.skills) continue;
        for (const s of c.skills) {
          if (s && s.id) map.set(s.id, s.name || s.id);
        }
      }
    } catch (e) {
      // ignore
    }
    return map;
  }, []);

  // inject mapping into notes module so it can resolve nodeNames server-side/client-side
  useEffect(() => {
    try {
      setSkillNameMap(Object.fromEntries(Array.from(skillNameMap.entries())));
    } catch (e) {
      // ignore
    }
  }, [skillNameMap]);

  // 渲染 markdown 为安全的 html
  const renderMarkdown = (text) => {
    try {
      const html = md.render(text || '');
      return { __html: DOMPurify.sanitize(html) };
    } catch (e) {
      return { __html: '' };
    }
  };

  // 左侧侧栏（竖排）
  const sidebar = (
    <div className={`absolute left-0 top-0 h-full z-40 bg-white/6 backdrop-blur-sm transition-transform border-r border-white/5 ${visible ? 'translate-x-0' : '-translate-x-full'}`} style={{ width: 360 }}>
      <div className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">笔记 <span className="text-sm text-white/60">({notes.length})</span></h3>
          <div className="flex items-center gap-2">
            <button className="text-sm px-2 py-1 bg-white/6 rounded" onClick={handleCreateInline}>新建</button>
            <button className="text-sm px-2 py-1 bg-white/6 rounded" onClick={onClose}>关闭</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto pr-2">
          <div className="mb-3">
            <div className="text-xs text-white/60">快速创建（点击新建进入全屏编辑）</div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">所有笔记</h4>
            <div className="flex flex-col gap-2">
              {notes.length === 0 && <div className="text-sm text-white/50">暂无笔记</div>}
              {notes.map(n => (
                <div key={n.id} className="p-2 bg-white/3 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">{n.title}</div>
                      <div className="text-xs text-white/60">{new Date(n.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-1 items-center">
                      {n.nodeIds && n.nodeIds.length > 0 && (
                        <div className="flex gap-1">
                          {n.nodeIds.map(id => (
                            <button key={id} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 transform hover:scale-105 transition" onClick={() => onOpenSkillById && onOpenSkillById(id)}>
                              <span className="mr-1">🔖</span>
                              {skillNameMap.get(id) || id}
                            </button>
                          ))}
                        </div>
                      )}
                      <button className="text-xs px-2 py-1 bg-white/6 rounded" onClick={() => openNoteInEditor(n)}>查看</button>
                      <button className="text-xs px-2 py-1 bg-red-700 rounded" onClick={() => handleDelete(n.id)}>删</button>
                    </div>
                  </div>
                  <div className="text-xs text-white/60 mt-2 line-clamp-3">{n.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 全屏只读预览（查看时展示）
  const editor = (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditing(null); refresh(); }} className="px-3 py-1 bg-white/6 rounded">返回</button>
          <div className="text-lg font-semibold">{title || '未命名笔记'}</div>
        </div>
        <div className="text-xs text-white/60">只读预览 — 编辑请在本地文件中操作</div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <div className="text-sm text-white/60 mb-2">关联节点</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {noteNodeIds && noteNodeIds.length > 0 ? (
              noteNodeIds.map((id, idx) => (
                <button key={id+idx} onClick={() => onOpenSkillById && onOpenSkillById(id)} className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 transform hover:scale-105 transition">
                  <span className="mr-2">🔖</span>{noteNodeNames && noteNodeNames[idx] ? noteNodeNames[idx] : id}
                </button>
              ))
            ) : (
              <div className="text-xs text-white/60">无关联节点</div>
            )}
          </div>
        </div>
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={renderMarkdown(content)} />
      </div>
    </div>
  );

  return (
    <>
      {!editing && sidebar}
      {editing && editor}
    </>
  );
};

export default NotesPanel;
