import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ConstellationView from './ConstellationView';
import NotesPanel from './NotesPanel';
import { constellationRegistry } from '../data';
import skyrimSkillData from '../data/skyrimSkillData.json';

const SkyrimSkillTree = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [unlockedSkills, setUnlockedSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null); // { left, top } in root coordinates (px)
  const [flashNodeId, setFlashNodeId] = useState(null);
  const [warningMsg, setWarningMsg] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [scale, setScale] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [notesPreviewOpen, setNotesPreviewOpen] = useState(false);
  // 初始向上偏移一点，使视图稍微向上展示（更接近自然阅读位置）
  const [pan, setPan] = useState({ x: 0, y: -10 }); // 视图单位偏移（0-100）
  const containerRef = useRef(null);
  const rootRef = useRef(null);
  const draggingRef = useRef({ dragging: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } });

  // allow dynamically appending constellations from other data files (notes may reference them)
  const [constellations, setConstellations] = useState(constellationRegistry);
  const currentConstellation = constellations[currentIndex];

  // 从 localStorage 加载进度
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skyrim_skill_progress');
      console.log('SkyrimSkillTree: 从 localStorage 加载 raw 值:', saved);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('SkyrimSkillTree: 解析后的已解锁技能:', parsed);
        setUnlockedSkills(parsed);
      }
    } catch (e) {
      console.error('SkyrimSkillTree: 加载进度失败:', e);
    }
  }, []);

  // 切换到下一个星座
  const nextConstellation = () => {
    setCurrentIndex((prev) => (prev + 1) % constellations.length);
    setSelectedSkill(null);
  };

  // Smoothly animate pan and scale to target values over duration (ms)
  const animatePanAndScale = (fromPan, toPan, fromScale, toScale, duration = 400) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 0.5 - Math.cos(t * Math.PI) / 2; // easeInOut
      const nx = fromPan.x + (toPan.x - fromPan.x) * ease;
      const ny = fromPan.y + (toPan.y - fromPan.y) * ease;
      const ns = fromScale + (toScale - fromScale) * ease;
      setPan({ x: nx, y: ny });
      setScale(ns);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const focusSkillById = (id) => {
    // close notes / preview
    setShowNotes(false);

  let foundIndex = constellations.findIndex(c => c.skills.some(s => s.id === id));

    const doFocus = (constellation) => {
      if (!constellation) return;
      const target = constellation.skills.find(s => s.id === id);
      if (!target) return;
      // compute transformed coordinates same as ConstellationView
      const spreadX = typeof constellation.spreadX === 'number' ? constellation.spreadX : (constellation.spread || 2.0);
      const spreadY = typeof constellation.spreadY === 'number' ? constellation.spreadY : (constellation.spread || 1.3);
      const centerX = 50;
      const centerY = 50;
      const tx = centerX + ((target.x || centerX) - centerX) * spreadX;
      const ty = centerY + ((target.y || centerY) - centerY) * spreadY;
      const panTarget = { x: centerX - tx, y: centerY - ty };
      const targetScale = Math.max(1, Math.min(1.6, scale * 1.15));
      // animate pan/scale
      animatePanAndScale(pan, panTarget, scale, targetScale, 450);
      // set selected and tooltip
      setSelectedSkill(target);
      setShowTooltip(true);
      // flash/highlight the node briefly
      setFlashNodeId(id);
      setTimeout(() => setFlashNodeId(null), 1200);
    };

  let appendedConstellation = null;
  if (foundIndex === -1) {
      // Try to find in skyrimSkillData (a larger dataset); if found, append that constellation so we can switch to it
      try {
        const other = (skyrimSkillData && skyrimSkillData.constellations) || [];
        const otherConst = other.find(c => (c.skills || []).some(s => s.id === id));
        if (otherConst) {
          // avoid duplicates by id
          const exists = constellations.findIndex(c => c.id === otherConst.id);
          if (exists === -1) {
            const next = [...constellations, otherConst];
            setConstellations(next);
            appendedConstellation = otherConst;
            foundIndex = next.length - 1;
          } else {
            foundIndex = exists;
          }
        }
      } catch (e) {
        console.error('SkyrimSkillTree: error searching alternate constellations', e);
      }
    }

    if (foundIndex !== -1 && foundIndex !== currentIndex) {
      setCurrentIndex(foundIndex);
      // wait for constellation switch animation to finish (approx)
      setTimeout(() => {
        // prefer appendedConstellation if we just added it, otherwise use state snapshot
        const targetConst = appendedConstellation || constellations[foundIndex] || (skyrimSkillData.constellations && skyrimSkillData.constellations.find(c => c.id === (constellations[foundIndex] && constellations[foundIndex].id)));
        doFocus(targetConst);
      }, 360);
      return;
    }
    doFocus(currentConstellation);
  };

  // 切换到上一个星座
  const prevConstellation = () => {
    setCurrentIndex((prev) => (prev - 1 + constellations.length) % constellations.length);
    setSelectedSkill(null);
  };

  // 检查技能是否可以解锁
  const canUnlock = (skill) => {
    // 根节点或无父节点可直接解锁
    if (!skill.parent) return true;
    // 如果节点配置了 freeUnlock，则允许单独点亮
    if (skill.freeUnlock) return true;
    // 否则要求父节点已解锁
    return unlockedSkills.includes(skill.parent);
  };

  // 处理技能点击
  const handleSkillClick = (skill, pos) => {
    // 先准备 tooltipPos（如果有）但不要默认打开 tooltip，只有在可查看或已解锁时再打开

    // 计算并设置 tooltip 的像素位置（相对于根容器）
  // 根据 note 中的 nodeId 打开对应技能（若在当前星座内）
    if (pos && rootRef.current && pos.rect) {
      const rootRect = rootRef.current.getBoundingClientRect();
      // pos.rect 是节点的 screen rect
      const nodeRect = pos.rect;
      // 希望弹窗的左下角（left,bottom）放在节点右侧一点，垂直对齐到节点中心
      const gap = 8; // 与节点的水平间隙
      const nodeCenterY = nodeRect.top + nodeRect.height / 2;
      // 计算 popup 宽度限制
      const popupWidth = Math.min(384, Math.max(200, rootRect.width - 32));

      // 按照要求：x 坐标选择为屏幕中心减去弹窗宽度（使弹窗右边缘对齐到中线），并做边界夹紧
      const centerX = Math.round(rootRect.width / 2);
      let leftPx = centerX - popupWidth;
      // 夹紧到可见范围，保留最小边距 16px
      leftPx = Math.max(16, Math.min(leftPx, rootRect.width - popupWidth - 16));

      // bottom（相对于 root 底部）= rootRect.height - nodeCenterY
      const bottomPx = Math.max(8, Math.round(rootRect.height - nodeCenterY));

      setTooltipPos({ left: leftPx, bottom: bottomPx, popupWidth });
    } else {
      setTooltipPos(null);
    }

    // 如果已解锁，则选中并显示详情
    if (unlockedSkills.includes(skill.id)) {
      setSelectedSkill(skill);
      setShowTooltip(true);
      const next = unlockedSkills.filter(id => id !== skill.id);
      setUnlockedSkills(next);
      console.log('SkyrimSkillTree: 取消解锁技能', skill.id, 'next unlockedSkills:', next);
      return;
    }

    // 检查是否可以解锁
    if (canUnlock(skill)) {
      // 可解锁：解锁并显示详情
      const next = [...unlockedSkills, skill.id];
      setUnlockedSkills(next);
      setSelectedSkill(skill);
      setShowTooltip(true);
      console.log('SkyrimSkillTree: 解锁技能', skill.id, 'next unlockedSkills:', next);
    } else {
      // 父节点未解锁：不要弹 alert，改为节点短暂变色并在屏幕中偏上位置显示暗红色警告，持续 1 秒
      const parentSkill = currentConstellation.skills.find(s => s.id === skill.parent);
      const parentName = parentSkill?.name || '前置技能';
      // 触发节点闪烁
      setFlashNodeId(skill.id);
      // 显示警告
      setWarningMsg(`${parentName} 未解锁，无法解锁 ${skill.name}！`);
      setShowWarning(true);
      // 1 秒后清除（恢复节点颜色与隐藏警告）
      setTimeout(() => {
        setFlashNodeId(null);
        setShowWarning(false);
        setWarningMsg('');
      }, 1000);
    }
  };

  // 重置所有进度
  const resetProgress = () => {
    if (window.confirm('确定要重置所有进度吗？此操作不可撤销！')) {
      setUnlockedSkills([]);
      setSelectedSkill(null);
      try {
        localStorage.removeItem('skyrim_skill_progress');
        console.log('SkyrimSkillTree: 已从 localStorage 删除 skyrim_skill_progress');
      } catch (e) {
        console.error('SkyrimSkillTree: 删除 localStorage 错误', e);
      }
    }
  };

  // 缩放控制
  const clampScale = (v) => Math.max(0.5, Math.min(3, v));
  const zoomIn = () => setScale(s => clampScale(Math.round((s * 1.1) * 100) / 100));
  const zoomOut = () => setScale(s => clampScale(Math.round((s / 1.1) * 100) / 100));
  const resetZoom = () => setScale(1);

  // 平移（拖拽）支持：pointer 事件
  const onPointerDown = (e) => {
    if (e.button !== 0) return; // 只响应左键
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    draggingRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPan: { ...pan }
    };
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current.dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    // 像素 -> viewBox(0-100) 单位
    const deltaX = (dx / rect.width) * 100;
    const deltaY = (dy / rect.height) * 100;
    const next = {
      x: Math.max(-300, Math.min(300, draggingRef.current.startPan.x + deltaX)),
      y: Math.max(-300, Math.min(300, draggingRef.current.startPan.y + deltaY))
    };
    setPan(next);
  };

  const onPointerUp = (e) => {
    if (!draggingRef.current.dragging) return;
    const el = containerRef.current;
    el.releasePointerCapture?.(e.pointerId);
    draggingRef.current.dragging = false;
  };

  // 计算当前星座的进度
  const currentProgress = currentConstellation.skills.filter(s => 
    unlockedSkills.includes(s.id)
  ).length;
  const currentTotal = currentConstellation.skills.length;

  // 计算总进度
  const totalSkills = constellations.reduce((sum, c) => sum + c.skills.length, 0);
  const totalUnlocked = unlockedSkills.length;

  // 调试：在每次渲染时输出当前星座与已解锁数组，便于定位刷新后渲染问题
  console.log('SkyrimSkillTree: render - currentConstellation:', currentConstellation.id, 'unlockedSkills:', unlockedSkills);

  return (
    <div 
      ref={rootRef}
      className={`w-screen h-screen overflow-hidden bg-gradient-to-b ${currentConstellation.gradient} text-white relative transition-all duration-1000`}
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {/* 简化的星空背景 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute w-1 h-1 bg-white rounded-full top-[10%] left-[15%]"></div>
        <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[25%] left-[35%]"></div>
        <div className="absolute w-1 h-1 bg-white rounded-full top-[40%] left-[55%]"></div>
        <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[15%] left-[75%]"></div>
        <div className="absolute w-1 h-1 bg-white rounded-full top-[60%] left-[20%]"></div>
        <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[75%] left-[65%]"></div>
        <div className="absolute w-1 h-1 bg-white rounded-full top-[85%] left-[40%]"></div>
        <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[30%] left-[85%]"></div>
      </div>

      {/* 暗角效果 */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: 'inset 0 0 150px rgba(0,0,0,0.7)'
      }}></div>

      {/* 顶部标题 - 缩小字体 */}
      <div className="absolute top-0 w-full p-6 text-center z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentConstellation.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
            <h1 
              className="text-3xl tracking-[0.3em] font-bold mb-2"
              style={{ 
                textShadow: `0 0 15px ${currentConstellation.glowColor}`,
                fontFamily: "'Cinzel', serif"
              }}
            >
              {currentConstellation.name}
            </h1>
            <div className="inline-block border-b border-white/30 pb-1 mb-2">
              <p className="text-base tracking-wide opacity-90">{currentConstellation.title}</p>
            </div>
            <p className="text-xs text-white/60 tracking-wide italic">
              {currentConstellation.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 左右切换按钮 - 缩小 */}
      <button
        onClick={prevConstellation}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-20 text-white/40 hover:text-white text-3xl p-3 transition-colors duration-200"
      >
        ❮
      </button>
      <button
        onClick={nextConstellation}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-20 text-white/40 hover:text-white text-3xl p-3 transition-colors duration-200"
      >
        ❯
      </button>

      {/* 星座绘制区域 - 简化动画 */}
      <div
        className="w-full h-full flex items-center justify-center p-16"
        ref={containerRef}
        onWheel={(e) => {
          // 按住 Ctrl 时缩放，避免与默认滚动冲突
          if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.05 : 0.95;
            setScale(s => clampScale(Math.round((s * factor) * 100) / 100));
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="w-full h-full max-w-5xl max-h-5xl relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentConstellation.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full"
            >
              <ConstellationView
                constellation={currentConstellation}
                unlockedSkills={unlockedSkills}
                onSkillClick={handleSkillClick}
                selectedSkillId={selectedSkill?.id}
                scale={scale}
                pan={pan}
                flashNodeId={flashNodeId}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 星座指示器 - 缩小 */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {constellations.map((constellation, index) => (
          <button
            key={constellation.id}
            onClick={() => {
              setCurrentIndex(index);
              setSelectedSkill(null);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === currentIndex 
                ? 'bg-white scale-125 shadow-lg' 
                : 'bg-white/30 hover:bg-white/60'
            }`}
            style={{
              boxShadow: index === currentIndex 
                ? `0 0 10px ${currentConstellation.glowColor}` 
                : 'none'
            }}
          />
        ))}
      </div>

      {/* 底部进度条 - 缩小字体 */}
      <div className="absolute bottom-8 w-full px-16 z-10">
        <div className="max-w-xl mx-auto">
          {/* 当前星座进度 */}
          <div className="text-center mb-2">
            <div className="text-xs tracking-wide text-white/60 mb-1">
              {currentConstellation.title}
            </div>
            <div className="text-xs tracking-wide text-white/90">
              技能掌握: {currentProgress} / {currentTotal}
            </div>
          </div>
          <div className="h-1 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
            <motion.div 
              className="h-full rounded-full"
              style={{ 
                width: `${(currentProgress / currentTotal) * 100}%`,
                background: `linear-gradient(90deg, ${currentConstellation.starColor}, ${currentConstellation.glowColor})`,
                boxShadow: `0 0 8px ${currentConstellation.glowColor}`
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(currentProgress / currentTotal) * 100}%` }}
            />
          </div>

          {/* 总体进度 */}
          <div className="text-center mt-3 text-xs tracking-wide text-white/50">
            总进度: {totalUnlocked} / {totalSkills} ({((totalUnlocked / totalSkills) * 100).toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* 技能详情面板 - Skyrim 风格底部居中 */}
      <AnimatePresence>
        {selectedSkill && showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bg-black/70 backdrop-blur-md border-t-2 border-b-2 p-4 z-30 text-center"
            style={{ 
              borderColor: `${currentConstellation.starColor}40`,
              boxShadow: `0 0 30px ${currentConstellation.glowColor}20`,
              // 使用计算好的像素位置（如果没有位置则回退到底部居中）
              left: tooltipPos ? `${tooltipPos.left}px` : '50%',
              bottom: tooltipPos ? `${tooltipPos.bottom}px` : undefined,
              top: tooltipPos ? undefined : undefined,
              width: tooltipPos ? `${tooltipPos.popupWidth}px` : undefined,
              transform: tooltipPos ? 'translateX(0)' : 'translateX(-50%)'
            }}
          >
            <button
              onClick={() => { setShowTooltip(false); setTooltipPos(null); }}
              className="absolute top-1 right-2 text-white/40 hover:text-white text-sm"
            >
              ✕
            </button>
            
            <h3 
              className="text-base font-bold mb-1 tracking-[0.25em] uppercase"
              style={{ 
                color: currentConstellation.starColor,
                fontFamily: "'Cinzel', serif"
              }}
            >
              {selectedSkill.name}
            </h3>
            
            <div className="flex justify-center items-center gap-3 mb-2">
              <div className="h-[1px] w-8 bg-white/20"></div>
              <span 
                className="text-[10px] tracking-widest uppercase font-bold"
                style={{ color: unlockedSkills.includes(selectedSkill.id) ? '#fff' : '#888' }}
              >
                {unlockedSkills.includes(selectedSkill.id) ? 'MASTERED' : 'LOCKED'}
              </span>
              <div className="h-[1px] w-8 bg-white/20"></div>
            </div>
            
            <p className="text-white/70 text-xs leading-5 tracking-wide px-4">
              {selectedSkill.desc}
            </p>
            
            {selectedSkill.parent && !unlockedSkills.includes(selectedSkill.id) && !canUnlock(selectedSkill) && (
              <div className="mt-3 pt-2 border-t border-white/10">
                <div className="text-[9px] text-red-400/80 tracking-widest uppercase">
                  Requires: {currentConstellation.skills.find(s => s.id === selectedSkill.parent)?.name}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 父节点未解锁时的短时警告（暗红色，屏幕正中偏上） */}
      {showWarning && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 left-1/2"
            style={{
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(70%, 480px)'
            }}
          >
            <div className="w-full text-center px-4 py-2 rounded-md text-sm text-red-100 bg-red-900/90 border border-red-700 shadow-lg">
              {warningMsg}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* 控制按钮 - 缩小 */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={resetProgress}
          className="px-3 py-1.5 bg-red-900/30 border border-red-500/50 text-red-300 rounded backdrop-blur-sm hover:bg-red-900/50 transition-all duration-200 text-xs tracking-wide"
        >
          🔄 重置进度
        </button>
        {/* 缩放控制按钮 */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={zoomOut}
            title="缩小"
            className="w-8 h-8 bg-white/6 rounded text-white/80 hover:bg-white/10"
          >
            −
          </button>
          <div className="text-xs text-white/80 px-2">{(scale * 100).toFixed(0)}%</div>
          <button
            onClick={zoomIn}
            title="放大"
            className="w-8 h-8 bg-white/6 rounded text-white/80 hover:bg-white/10"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            title="重置缩放"
            className="ml-2 px-2 h-8 bg-white/6 rounded text-white/60 hover:bg-white/10 text-xs"
          >
            重置
          </button>
        </div>
        {/* 笔记按钮已移至左侧边缘拉出标签，以便更直观的侧栏交互 */}
      </div>
      {/* 笔记面板（侧栏） */}
      <NotesPanel
        visible={showNotes}
        onClose={() => setShowNotes(false)}
        selectedSkill={selectedSkill}
        onOpenSkillById={focusSkillById}
        onPreviewChange={setNotesPreviewOpen}
      />
      {/* 左侧拉出/隐藏标签 */}
      <div
        className="fixed top-[35%] z-50"
        // 动画地将 tab 从屏幕左侧移动到侧栏右侧，使其看起来像贴在侧栏边缘
        style={{ left: showNotes ? '360px' : 0, transition: 'left 220ms ease', display: notesPreviewOpen ? 'none' : undefined }}
      >
        <button
          onClick={() => setShowNotes(s => !s)}
          aria-label="Toggle notes panel"
          className="flex items-center justify-center w-12 h-28 rounded-r-md bg-white/6 text-white/90 hover:bg-white/10 border-l border-white/5 shadow-md"
          title="笔记"
        >
          {/* 竖排显示：把两个汉字竖着堆叠，兼容性稳定 */}
          <span className="flex flex-col items-center leading-none text-sm">
            <span>笔</span>
            <span>记</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default SkyrimSkillTree;
