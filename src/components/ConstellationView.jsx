import React, { useRef } from 'react';
import { motion } from 'framer-motion';

// 星星节点组件 - 更稳定的交互与视觉
const StarNode = ({ skill, isUnlocked, onClick, starColor, glowColor, isSelected, isFlashing }) => {
  const nodeRef = useRef(null);
  return (
    // 阻止 pointerdown 向上冒泡到容器，避免容器把指针捕获后吞掉点击事件
    <g
      ref={nodeRef}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        // 计算节点在视口中的中心坐标，并把 rect 一并传回上层以便精确定位弹窗
        try {
          const rect = nodeRef.current?.getBoundingClientRect();
          const pos = rect ? { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, rect } : null;
          onClick && onClick(skill, pos);
        } catch (err) {
          onClick && onClick(skill, null);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <circle cx={skill.x} cy={skill.y} r="5" fill="transparent" />
      {isSelected && (
        <motion.circle
          cx={skill.x}
          cy={skill.y}
          r="3"
          fill="none"
          stroke={starColor}
          strokeWidth="0.2"
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <motion.circle
        cx={skill.x}
        cy={skill.y}
        r={isUnlocked ? 1.2 : 0.8}
        fill={isFlashing ? '#4f1b1b' : (isUnlocked ? "#fff" : "#444")}
        stroke={isFlashing ? '#ff6b6b' : (isUnlocked ? starColor : "transparent")}
        strokeWidth="0.3"
        style={{ filter: isUnlocked ? `drop-shadow(0 0 3px ${glowColor})` : 'none' }}
        animate={isFlashing ? { scale: [1, 1.6, 1], opacity: [1, 0.7, 1] } : undefined}
        transition={isFlashing ? { duration: 0.9 } : undefined}
        whileHover={{ fill: "#fff", filter: `drop-shadow(0 0 5px ${starColor})` }}
      />

      <text
        x={skill.x}
        y={skill.y + 4}
        textAnchor="middle"
        fill={isUnlocked ? "#fff" : "#666"}
        fontSize="1.6"
        className="select-none pointer-events-none"
        style={{
          fontFamily: "'Cinzel', serif",
          textShadow: isUnlocked ? `0 0 4px ${glowColor}` : 'none',
          letterSpacing: '0.05em'
        }}
      >
        {skill.name}
      </text>
    </g>
  );
};

const ConstellationLine = ({ start, end, isActive, isDim, starColor }) => {
  const opacity = isActive ? 0.6 : (isDim ? 0.3 : 0.08);
  return (
    <motion.line
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: opacity }}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={isActive ? starColor : '#555'}
      strokeWidth={isActive ? 0.5 : 0.3}
      strokeDasharray={isDim ? '1 1' : '0'}
    />
  );
};

// 主星座视图：允许无限画布并支持摄像机变换
const ConstellationView = ({ constellation, unlockedSkills, onSkillClick, selectedSkillId, scale = 1, pan = { x: 0, y: 0 }, flashNodeId = null }) => {
  const { skills, starColor, glowColor } = constellation;

  // 移除 clamp，允许节点坐标超出 0..100
  // 默认向两侧更大幅度扩张；如需单独调节，请在星座 JSON 中设置 spreadX / spreadY
  const spreadX = typeof constellation.spreadX === 'number' ? constellation.spreadX : (constellation.spread || 2.0);
  const spreadY = typeof constellation.spreadY === 'number' ? constellation.spreadY : (constellation.spread || 1.3);
  const centerX = 50;
  const centerY = 50;

  const transformedSkills = skills.map(s => ({
    ...s,
    x: centerX + ((s.x || centerX) - centerX) * spreadX,
    y: centerY + ((s.y || centerY) - centerY) * spreadY
  }));

  // 变换顺序：先以屏幕中心缩放（scale），然后应用 pan 平移（pan 单位与 viewBox 对齐）
  const transformMatrix = `translate(${centerX}, ${centerY}) scale(${scale}) translate(${-centerX + (pan.x || 0)}, ${-centerY + (pan.y || 0)})`;

  return (
    <svg
      className="w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible', pointerEvents: 'none' }}
    >
      {/* 恢复内部交互到 auto，以兼容 SVG 的 pointer-events 语义 */}
      <g style={{ pointerEvents: 'auto' }}>
        <g transform={transformMatrix}>
          {/* 连线层 */}
          {transformedSkills.map(skill => {
            const parentSkill = transformedSkills.find(s => s.id === skill.parent);
            if (!parentSkill) return null;
            return (
              <ConstellationLine
                key={`${skill.id}-line`}
                start={parentSkill}
                end={skill}
                isActive={unlockedSkills.includes(skill.id) && unlockedSkills.includes(parentSkill.id)}
                isDim={unlockedSkills.includes(skill.id) && !unlockedSkills.includes(parentSkill.id)}
                starColor={starColor}
              />
            );
          })}

          {/* 节点层 */}
          {transformedSkills.map(skill => (
            <StarNode
              key={skill.id}
              skill={skill}
              isUnlocked={unlockedSkills.includes(skill.id)}
              isSelected={selectedSkillId === skill.id}
              // StarNode 会把 (skill, {clientX, clientY, rect}) 传回来
              onClick={onSkillClick}
              starColor={starColor}
              glowColor={glowColor}
              isFlashing={flashNodeId === skill.id}
            />
          ))}
        </g>
      </g>
    </svg>
  );
};

export default ConstellationView;
