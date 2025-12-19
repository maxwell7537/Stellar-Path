# 🎯 功能扩展建议

本文档提供了一些高级功能扩展的思路和代码示例，帮助你将技能树系统打造得更加强大！

---

## 1. 学习笔记系统 📝

### 功能描述
为每个技能节点添加 Markdown 格式的学习笔记，支持代码高亮、图片等。

### 实现思路

#### 安装依赖
```bash
npm install react-markdown remark-gfm react-syntax-highlighter
```

#### 数据结构扩展
```json
{
  "id": "lang_python",
  "name": "Python 蛇语",
  "notes": "# Python 学习笔记\n\n## 基础语法\n```python\nprint('Hello World')\n```",
  "resources": [
    { "title": "官方文档", "url": "https://docs.python.org" }
  ]
}
```

#### 组件示例
```jsx
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

const NotePanel = ({ node }) => (
  <div className="p-4 bg-gray-900 rounded">
    <ReactMarkdown
      components={{
        code({node, inline, className, children, ...props}) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <SyntaxHighlighter language={match[1]} PreTag="div">
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>{children}</code>
          )
        }
      }}
    >
      {node.notes}
    </ReactMarkdown>
  </div>
);
```

---

## 2. 学习时长统计 ⏱️

### 功能描述
记录每个技能的学习时长，生成学习报告。

### 实现思路

#### 数据结构
```json
{
  "id": "lang_python",
  "studyTime": 7200,  // 秒
  "startDate": "2025-01-01",
  "completedDate": "2025-01-15",
  "sessions": [
    { "date": "2025-01-01", "duration": 3600 }
  ]
}
```

#### 计时器组件
```jsx
const StudyTimer = ({ nodeId, onSave }) => {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-lg font-mono">{formatTime(seconds)}</span>
      <button onClick={() => setIsRunning(!isRunning)}>
        {isRunning ? '⏸️ 暂停' : '▶️ 开始'}
      </button>
      <button onClick={() => onSave(seconds)}>💾 保存</button>
    </div>
  );
};
```

---

## 3. 成就系统 🏆

### 功能描述
完成特定任务解锁成就徽章，增加游戏化体验。

### 成就设计示例

```javascript
const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    name: '初窥门径',
    desc: '点亮第一个技能',
    icon: '🎯',
    condition: (stats) => stats.mastered >= 1
  },
  {
    id: 'python_master',
    name: 'Python 大师',
    desc: '掌握所有 Python 相关技能',
    icon: '🐍',
    condition: (nodes) => {
      const pythonNodes = nodes.filter(n => n.id.includes('python'));
      return pythonNodes.every(n => n.status === 'mastered');
    }
  },
  {
    id: 'week_streak',
    name: '勤奋修行者',
    desc: '连续 7 天学习',
    icon: '🔥',
    condition: (sessions) => {
      // 检查连续登录天数
      return checkConsecutiveDays(sessions, 7);
    }
  },
  {
    id: 'full_stack',
    name: '全栈工程师',
    desc: '掌握前端、后端、数据库所有技能',
    icon: '⚡',
    condition: (nodes, categories) => {
      const requiredCats = ['Web开发', '数据库'];
      return requiredCats.every(catName => {
        const cat = categories.find(c => c.name === catName);
        const catNodes = nodes.filter(n => n.category === cat.id);
        return catNodes.every(n => n.status === 'mastered');
      });
    }
  }
];
```

#### 成就展示组件
```jsx
const AchievementBadge = ({ achievement, unlocked }) => (
  <div className={`
    relative p-4 rounded-lg border-2 transition-all
    ${unlocked 
      ? 'border-yellow-400 bg-yellow-900 bg-opacity-20 shadow-neon-pink' 
      : 'border-gray-700 bg-gray-900 opacity-50 grayscale'
    }
  `}>
    <div className="text-4xl text-center mb-2">{achievement.icon}</div>
    <div className="text-center font-bold text-yellow-400">{achievement.name}</div>
    <div className="text-xs text-gray-400 text-center mt-1">{achievement.desc}</div>
    {unlocked && (
      <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
        <span className="text-white text-xs">✓</span>
      </div>
    )}
  </div>
);
```

---

## 4. 数据可视化看板 📊

### 功能描述
用图表展示学习进度、时间分布等统计信息。

### 使用 ECharts 实现

```jsx
const StatsPanel = ({ nodes, categories }) => {
  // 分类掌握度饼图
  const categoryStats = categories.map(cat => ({
    name: cat.name,
    value: nodes.filter(n => n.category === cat.id && n.status === 'mastered').length
  }));

  const pieOption = {
    title: { text: '技能分类掌握度', textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: categoryStats,
      label: { color: '#fff' }
    }]
  };

  // 学习进度趋势图
  const trendOption = {
    xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' },
    series: [{
      data: [5, 8, 12, 15, 18, 22, 25],
      type: 'line',
      smooth: true,
      areaStyle: { color: 'rgba(0, 242, 255, 0.3)' }
    }]
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <ReactECharts option={pieOption} />
      <ReactECharts option={trendOption} />
    </div>
  );
};
```

---

## 5. 社交分享功能 🌐

### 功能描述
生成漂亮的分享卡片，炫耀学习成果。

### 实现方案

#### 使用 html2canvas 生成图片
```bash
npm install html2canvas
```

```jsx
import html2canvas from 'html2canvas';

const ShareCard = ({ stats, username }) => {
  const cardRef = useRef(null);

  const generateImage = async () => {
    const canvas = await html2canvas(cardRef.current);
    const imgData = canvas.toDataURL('image/png');
    
    // 下载图片
    const link = document.createElement('a');
    link.href = imgData;
    link.download = 'my-skill-tree.png';
    link.click();
  };

  return (
    <>
      <div ref={cardRef} className="w-[600px] h-[400px] bg-gradient-to-br from-cyber-dark to-purple-900 p-8">
        <h1 className="text-4xl font-bold text-cyber-blue">我的修行成果</h1>
        <div className="mt-8 text-2xl text-white">
          <p>已掌握技能: <span className="text-yellow-400">{stats.mastered}</span></p>
          <p>学习进度: <span className="text-green-400">{stats.progress}%</span></p>
        </div>
        <div className="mt-8 text-gray-400">@{username}</div>
      </div>
      <button onClick={generateImage}>📸 生成分享图片</button>
    </>
  );
};
```

---

## 6. 音效系统 🔊

### 功能描述
为操作添加音效反馈，提升沉浸感。

### 实现示例

```jsx
const SoundManager = {
  unlock: new Audio('/sounds/unlock.mp3'),
  master: new Audio('/sounds/master.mp3'),
  click: new Audio('/sounds/click.mp3'),
  
  play(soundName) {
    this[soundName]?.play();
  }
};

// 在节点点击事件中使用
const handleNodeClick = (params) => {
  // ... 原有逻辑
  
  if (clickedNode.status === 'locked' && canUnlock(clickedNode)) {
    SoundManager.play('unlock');
    newNodes[nodeIndex].status = 'unlocked';
  } else if (clickedNode.status === 'unlocked') {
    SoundManager.play('master');
    newNodes[nodeIndex].status = 'mastered';
  }
};
```

---

## 7. AI 推荐学习路径 🤖

### 功能描述
根据用户已掌握技能，推荐最优学习路径。

### 算法思路

```javascript
const recommendNextSkills = (nodes, masteredIds) => {
  // 1. 找出所有可解锁的技能
  const unlockable = nodes.filter(node => {
    if (node.status !== 'locked') return false;
    return node.prerequisites?.every(prereq => 
      masteredIds.includes(prereq)
    );
  });

  // 2. 按重要度排序（可根据依赖它的技能数量）
  const scored = unlockable.map(node => {
    const dependentCount = nodes.filter(n => 
      n.prerequisites?.includes(node.id)
    ).length;
    
    return {
      ...node,
      score: dependentCount
    };
  });

  // 3. 返回推荐列表
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
};
```

---

## 8. 多主题切换 🎨

### 主题配置

```javascript
const THEMES = {
  cyber: {
    primary: '#00f2ff',
    secondary: '#ff00ff',
    background: '#0a0e27'
  },
  matrix: {
    primary: '#00ff00',
    secondary: '#008800',
    background: '#000000'
  },
  sunset: {
    primary: '#ff6b6b',
    secondary: '#ffa500',
    background: '#1a1a2e'
  }
};
```

---

## 9. 多人协作模式 👥

### 功能描述
多人共享同一个技能树，团队学习。

### 实现方案
- 使用 Firebase Realtime Database
- WebSocket 实时同步
- 显示其他成员的学习进度

---

## 10. 移动端适配 📱

### 响应式设计

```jsx
// 检测设备
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

// 调整布局
<div className={`
  ${isMobile ? 'flex-col' : 'flex-row'}
  ${isMobile ? 'text-sm' : 'text-base'}
`}>
```

---

## 总结

以上功能可以根据需求逐步实现，每个功能都能显著提升用户体验！

选择你最感兴趣的功能开始开发吧！🚀
