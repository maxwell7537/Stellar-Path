import React from 'react';
import { motion } from 'framer-motion';

// 星星节点组件 - Skyrim 风格微小星点
const StarNode = ({ skill, isUnlocked, onClick, starColor, glowColor, isSelected }) => {
  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* 隐形点击热区 - 方便点击 */}
      <circle cx={skill.x} cy={skill.y} r="3" fill="transparent" />
      
      {/* 选中时的光环 */}
      {isSelected && (
        <motion.circle
          cx={skill.x}
          cy={skill.y}
          r="2.5"
          fill="none"
          stroke={starColor}
          strokeWidth="0.15"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      
      {/* 星星本体 - 极小且静态 */}
      <motion.circle
        cx={skill.x}
        cy={skill.y}
        r={isUnlocked ? 1.2 : 0.8}
        fill={isUnlocked ? "#fff" : "#666"}
        stroke={isUnlocked ? starColor : "transparent"}
        strokeWidth="0.3"
        style={{
          filter: isUnlocked ? `drop-shadow(0 0 2px ${glowColor})` : 'none'
        }}
        whileHover={{
          fill: "#fff",
          filter: `drop-shadow(0 0 4px ${starColor})`,
          transition: { duration: 0.2 }
        }}
      />
      
      {/* 技能名称 - 极小字体 */}
      <text
        x={skill.x}
        y={skill.y + 3.5}
        textAnchor="middle"
        fill={isUnlocked ? starColor : "#888"}
        fontSize="1.8"
        fontWeight={isUnlocked ? "600" : "400"}
        className="select-none pointer-events-none"
        style={{ 
          fontFamily: "'Cinzel', serif",
          opacity: isUnlocked || isSelected ? 0.9 : 0.5,
          textShadow: isUnlocked ? `0 0 1px ${starColor}` : 'none'
        }}
      >
        {skill.name}
      </text>
    </g>
  );
};

// 连线组件 - 极细线条
const ConstellationLine = ({ start, end, isActive, starColor }) => {
  return (
    <motion.line
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ 
        pathLength: 1, 
        opacity: isActive ? 0.7 : 0.15
      }}
      transition={{ duration: 1, ease: "easeInOut" }}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={isActive ? starColor : "#666"}
      strokeWidth={isActive ? 0.6 : 0.4}
      strokeLinecap="round"
      style={{
        filter: isActive ? `drop-shadow(0 0 1px ${starColor})` : 'none'
      }}
    />
  );
};

// 主星座视图
const ConstellationView = ({ constellation, unlockedSkills, onSkillClick, selectedSkillId }) => {
  const { skills, starColor, glowColor } = constellation;

  return (
    <svg 
      className="w-full h-full" 
      viewBox="0 0 100 100" 
      preserveAspectRatio="xMidYMid meet"
    >
      <g>
        {/* 绘制连线 */}
        {skills.map(skill => {
          if (!skill.parent) return null;
          const parentSkill = skills.find(s => s.id === skill.parent);
          if (!parentSkill) return null;
          
          const isActive = unlockedSkills.includes(skill.id) && unlockedSkills.includes(parentSkill.id);
          
          return (
            <ConstellationLine
              key={`${skill.id}-line`}
              start={parentSkill}
              end={skill}
              isActive={isActive}
              starColor={starColor}
            />
          );
        })}

        {/* 绘制星星 */}
        {skills.map(skill => (
          <StarNode
            key={skill.id}
            skill={skill}
            isUnlocked={unlockedSkills.includes(skill.id)}
            isSelected={selectedSkillId === skill.id}
            onClick={() => onSkillClick(skill)}
            starColor={starColor}
            glowColor={glowColor}
          />
        ))}
      </g>
    </svg>
  );
};

export default ConstellationView;
