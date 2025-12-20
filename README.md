# Stellar Path - 星途

基于 Skyrim 星座风格的技能解锁可视化（SVG 渲染）。

主要功能
- 星座风格技能节点与连线
- 节点状态：locked / unlocked / mastered
- 本地保存、导出与导入 JSON

快速开始
1. 安装依赖

```bash
npm install
```

2. 启动开发服务器

```bash
npm run dev
```

构建与预览

```bash
npm run build
npm run preview
```

数据说明
- 使用 Skyrim 风格星座数据：`src/data/skyrimSkillData.json`
- 最小示例：

采用

```
├── src
│   ├── App.css                    # 全局样式与动画
│   ├── App.jsx                    # 应用根组件（当前渲染 SkyrimSkillTree）
│   ├── components
│   │   ├── ConstellationView.jsx  # Skyrim 风格 SVG 星座渲染
│   │   ├── ParticleBackground.jsx # 粒子背景特效组件
│   │   └── SkyrimSkillTree.jsx    # 主题化星座技能树及交互逻辑（当前默认渲染）
│   ├── data
│   │   └── skyrimSkillData.json   # Skyrim 星座与技能数据
│   ├── index.css                  # 基础样式
│   └── main.jsx                   # React 入口，挂载根组件
├── public/                         # 静态资源
├── index.html                      # HTML 模板
├── package.json                    # 依赖与脚本（dev/build/preview）
├── vite.config.js                  # Vite 构建配置
├── tailwind.config.js              # Tailwind CSS 配置
├── postcss.config.js               # PostCSS 配置
└── README.md                       # 本文件

重新生成
node scripts/build-notes-manifest.js