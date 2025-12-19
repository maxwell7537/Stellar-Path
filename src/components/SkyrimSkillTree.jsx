import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConstellationView from './ConstellationView';
import skyrimData from '../data/skyrimSkillData.json';

const SkyrimSkillTree = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [unlockedSkills, setUnlockedSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const constellations = skyrimData.constellations;
  const currentConstellation = constellations[currentIndex];

  // 从 localStorage 加载进度
  useEffect(() => {
    const saved = localStorage.getItem('skyrim_skill_progress');
    if (saved) {
      try {
        setUnlockedSkills(JSON.parse(saved));
      } catch (e) {
        console.error('加载进度失败:', e);
      }
    }
  }, []);

  // 自动保存进度
  useEffect(() => {
    localStorage.setItem('skyrim_skill_progress', JSON.stringify(unlockedSkills));
  }, [unlockedSkills]);

  // 切换到下一个星座
  const nextConstellation = () => {
    setCurrentIndex((prev) => (prev + 1) % constellations.length);
    setSelectedSkill(null);
  };

  // 切换到上一个星座
  const prevConstellation = () => {
    setCurrentIndex((prev) => (prev - 1 + constellations.length) % constellations.length);
    setSelectedSkill(null);
  };

  // 检查技能是否可以解锁
  const canUnlock = (skill) => {
    if (!skill.parent) return true;
    return unlockedSkills.includes(skill.parent);
  };

  // 处理技能点击
  const handleSkillClick = (skill) => {
    setSelectedSkill(skill);
    setShowTooltip(true);

    // 如果已解锁，可以取消解锁
    if (unlockedSkills.includes(skill.id)) {
      setUnlockedSkills(unlockedSkills.filter(id => id !== skill.id));
      return;
    }

    // 检查是否可以解锁
    if (canUnlock(skill)) {
      setUnlockedSkills([...unlockedSkills, skill.id]);
    } else {
      // 播放错误提示
      const parentSkill = currentConstellation.skills.find(s => s.id === skill.parent);
      alert(`需要先学习：${parentSkill?.name || '前置技能'}`);
    }
  };

  // 重置所有进度
  const resetProgress = () => {
    if (window.confirm('确定要重置所有进度吗？此操作不可撤销！')) {
      setUnlockedSkills([]);
      setSelectedSkill(null);
      localStorage.removeItem('skyrim_skill_progress');
    }
  };

  // 计算当前星座的进度
  const currentProgress = currentConstellation.skills.filter(s => 
    unlockedSkills.includes(s.id)
  ).length;
  const currentTotal = currentConstellation.skills.length;

  // 计算总进度
  const totalSkills = constellations.reduce((sum, c) => sum + c.skills.length, 0);
  const totalUnlocked = unlockedSkills.length;

  return (
    <div 
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
      <div className="w-full h-full flex items-center justify-center p-16">
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
            className="absolute bottom-32 left-1/2 -translate-x-1/2 w-96 bg-black/70 backdrop-blur-md border-t-2 border-b-2 p-4 z-30 text-center"
            style={{ 
              borderColor: `${currentConstellation.starColor}40`,
              boxShadow: `0 0 30px ${currentConstellation.glowColor}20`
            }}
          >
            <button
              onClick={() => setShowTooltip(false)}
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

      {/* 控制按钮 - 缩小 */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={resetProgress}
          className="px-3 py-1.5 bg-red-900/30 border border-red-500/50 text-red-300 rounded backdrop-blur-sm hover:bg-red-900/50 transition-all duration-200 text-xs tracking-wide"
        >
          🔄 重置进度
        </button>
      </div>
    </div>
  );
};

export default SkyrimSkillTree;
