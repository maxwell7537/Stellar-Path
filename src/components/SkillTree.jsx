import React, { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import skillTreeDataImport from '../data/skillTreeData.json';
import ParticleBackground from './ParticleBackground';

const SkillTree = () => {
  const [skillData, setSkillData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    // 从 localStorage 加载进度，如果没有则使用默认数据
    const savedProgress = localStorage.getItem('skillTreeProgress');
    if (savedProgress) {
      setSkillData(JSON.parse(savedProgress));
    } else {
      setSkillData(skillTreeDataImport);
    }
  }, []);

  // 构建树形数据结构
  const buildTreeData = () => {
    if (!skillData) return null;

    // 创建节点映射，深拷贝并添加样式
    const nodeMap = new Map();
    skillData.nodes.forEach(node => {
      const category = skillData.categories.find(c => c.id === node.category);
      const baseColor = category?.color || '#00f2ff';
      
      // 根据状态设置颜色
      let nodeColor = baseColor;
      let borderColor = baseColor;
      let borderWidth = 2;
      let shadowBlur = 10;
      let symbolSize = 30;
      
      if (node.status === 'locked') {
        nodeColor = '#1a1a2e';
        borderColor = '#333';
        borderWidth = 1;
        shadowBlur = 0;
        symbolSize = 24;
      } else if (node.status === 'mastered') {
        borderColor = '#fff';
        borderWidth = 3;
        shadowBlur = 20;
        symbolSize = 36;
      }
      
      nodeMap.set(node.id, {
        name: node.name,
        id: node.id,
        category: node.category,
        status: node.status,
        desc: node.desc,
        prerequisites: node.prerequisites || [],
        children: [],
        symbolSize: symbolSize,
        itemStyle: {
          color: nodeColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          shadowBlur: shadowBlur,
          shadowColor: baseColor
        },
        label: {
          color: node.status === 'locked' ? '#666' : '#fff',
          fontWeight: node.status === 'mastered' ? 'bold' : 'normal',
          fontSize: node.status === 'locked' ? 11 : 13
        }
      });
    });

    // 找到根节点
    let rootNode = null;
    const addedNodes = new Set();
    
    skillData.nodes.forEach(node => {
      if (!node.prerequisites || node.prerequisites.length === 0) {
        rootNode = nodeMap.get(node.id);
        addedNodes.add(node.id);
      }
    });

    // 递归添加子节点
    const addChildren = (parentNode) => {
      if (!parentNode) return;
      
      // 找到所有以当前节点为前置条件的节点
      skillData.nodes.forEach(node => {
        if (node.prerequisites && 
            node.prerequisites.includes(parentNode.id) && 
            !addedNodes.has(node.id)) {
          const childNode = nodeMap.get(node.id);
          if (childNode) {
            parentNode.children.push(childNode);
            addedNodes.add(node.id);
            addChildren(childNode); // 递归添加子节点的子节点
          }
        }
      });
    };

    if (rootNode) {
      addChildren(rootNode);
    }

    // 清理空的children数组
    const cleanEmptyChildren = (node) => {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        node.children.forEach(cleanEmptyChildren);
      }
    };
    
    if (rootNode) {
      cleanEmptyChildren(rootNode);
    }

    console.log('构建的树形数据:', rootNode);
    console.log('已添加的节点数:', addedNodes.size, '/', skillData.nodes.length);

    return rootNode;
  };

  // 检查节点是否可以被解锁
  const canUnlock = (node) => {
    if (!node.prerequisites || node.prerequisites.length === 0) {
      return true;
    }
    return node.prerequisites.every(prereqId => {
      const prereqNode = skillData.nodes.find(n => n.id === prereqId);
      return prereqNode && (prereqNode.status === 'mastered' || prereqNode.status === 'unlocked');
    });
  };

  // 处理节点点击事件
  const handleNodeClick = (params) => {
    if (params.data && params.data.id) {
      const clickedNode = skillData.nodes.find(n => n.id === params.data.id);
      setSelectedNode(clickedNode);
      
      if (!clickedNode) return;

      const newNodes = [...skillData.nodes];
      const nodeIndex = newNodes.findIndex(n => n.id === clickedNode.id);

      // 状态切换逻辑
      if (clickedNode.status === 'locked') {
        if (canUnlock(clickedNode)) {
          newNodes[nodeIndex] = { ...clickedNode, status: 'unlocked' };
        } else {
          alert('前置技能尚未解锁！请先完成前置技能的学习。');
          return;
        }
      } else if (clickedNode.status === 'unlocked') {
        newNodes[nodeIndex] = { ...clickedNode, status: 'mastered' };
      } else if (clickedNode.status === 'mastered') {
        // 可选：点击已掌握的技能，退回到已解锁状态
        newNodes[nodeIndex] = { ...clickedNode, status: 'unlocked' };
      }

      const newSkillData = { ...skillData, nodes: newNodes };
      setSkillData(newSkillData);
      
      // 自动保存到 localStorage
      localStorage.setItem('skillTreeProgress', JSON.stringify(newSkillData));
    }
  };

  // ECharts 配置
  const getOption = () => {
    if (!skillData) return {};

    const treeData = buildTreeData();
    console.log('Tree Data:', treeData); // 调试信息

    if (!treeData) {
      console.error('树形数据构建失败');
      return {};
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10, 14, 39, 0.95)',
        borderColor: '#00f2ff',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 14
        },
        formatter: (params) => {
          if (params.data) {
            const node = params.data;
            const category = skillData.categories.find(c => c.id === node.category);
            const statusText = {
              'locked': '🔒 未解锁',
              'unlocked': '🔓 可学习',
              'mastered': '✨ 已掌握'
            }[node.status];
            
            return `
              <div style="padding: 8px;">
                <div style="font-size: 16px; font-weight: bold; color: ${category?.color}; margin-bottom: 8px;">
                  ${node.name}
                </div>
                <div style="color: #aaa; margin-bottom: 4px;">
                  分类: ${category?.name || '未知'}
                </div>
                <div style="margin-bottom: 8px;">
                  状态: ${statusText}
                </div>
                <div style="color: #ccc; font-size: 12px; line-height: 1.5;">
                  ${node.desc || '暂无描述'}
                </div>
              </div>
            `;
          }
          return '';
        }
      },
      series: [
        {
          type: 'tree',
          data: [treeData],
          orient: 'LR', // 从左到右布局
          left: '10%',
          right: '10%',
          top: '10%',
          bottom: '10%',
          symbol: 'circle',
          edgeShape: 'curve',
          edgeForkPosition: '63%',
          initialTreeDepth: -1,
          expandAndCollapse: false,
          animationDuration: 550,
          animationEasing: 'cubicOut',
          roam: true, // 允许缩放和拖拽
          scaleLimit: {
            min: 0.2,
            max: 5
          },
          label: {
            show: true,
            position: 'right',
            distance: 10,
            formatter: '{b}'
          },
          lineStyle: {
            color: '#555',
            width: 2,
            curveness: 0.5
          },
          emphasis: {
            focus: 'descendant',
            itemStyle: {
              borderWidth: 4,
              shadowBlur: 30
            },
            label: {
              fontSize: 15,
              fontWeight: 'bold'
            },
            lineStyle: {
              width: 3
            }
          },
          leaves: {
            label: {
              position: 'right',
              distance: 10
            }
          }
        }
      ]
    };
  };

  // 导出进度
  const exportProgress = () => {
    const dataStr = JSON.stringify(skillData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skill_tree_progress_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 导入进度
  const importProgress = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        setSkillData(imported);
        localStorage.setItem('skillTreeProgress', JSON.stringify(imported));
        alert('进度加载成功！');
      } catch (error) {
        alert('文件格式错误，无法加载！');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // 重置 input
  };

  // 重置进度
  const resetProgress = () => {
    if (window.confirm('确定要重置所有进度吗？此操作不可撤销！')) {
      const resetData = {
        ...skillTreeDataImport,
        nodes: skillTreeDataImport.nodes.map(node => ({
          ...node,
          status: node.id === 'root' ? 'mastered' : 'locked'
        }))
      };
      setSkillData(resetData);
      localStorage.setItem('skillTreeProgress', JSON.stringify(resetData));
      setSelectedNode(null);
    }
  };

  if (!skillData) {
    return (
      <div className="flex items-center justify-center h-screen bg-cyber-dark text-cyber-blue">
        <div className="text-2xl animate-pulse">正在加载技能树...</div>
      </div>
    );
  }

  const stats = {
    total: skillData.nodes.length,
    mastered: skillData.nodes.filter(n => n.status === 'mastered').length,
    unlocked: skillData.nodes.filter(n => n.status === 'unlocked').length,
    locked: skillData.nodes.filter(n => n.status === 'locked').length
  };

  return (
    <div className="relative w-screen h-screen bg-cyber-dark overflow-hidden">
      {/* 粒子背景 */}
      <ParticleBackground />
      
      {/* 背景网格效果 */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      
      {/* 标题 */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 bg-gradient-to-b from-cyber-dark to-transparent">
        <h1 className="text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-pink animate-gradient">
          ⚡ 星途 ⚡
        </h1>
        <p className="text-center text-gray-400 mt-2">点击节点点亮技能 · 解锁知识经络</p>
      </div>

      {/* ECharts 图表 */}
      <ReactECharts
        ref={chartRef}
        option={getOption()}
        style={{ width: '100%', height: '100%' }}
        onEvents={{ click: handleNodeClick }}
        opts={{ renderer: 'canvas' }}
      />

      {/* 统计面板 */}
      <div className="absolute top-24 left-6 bg-cyber-dark bg-opacity-80 backdrop-blur-md border border-cyber-blue rounded-lg p-4 shadow-neon-blue">
        <h3 className="text-cyber-blue font-bold mb-3 text-lg">📊 修行进度</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">总技能数:</span>
            <span className="text-white font-bold">{stats.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-400">✨ 已掌握:</span>
            <span className="text-cyan-400 font-bold">{stats.mastered}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-400">🔓 可学习:</span>
            <span className="text-yellow-400 font-bold">{stats.unlocked}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">🔒 未解锁:</span>
            <span className="text-gray-500 font-bold">{stats.locked}</span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400">完成度</div>
          <div className="mt-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyber-blue to-cyber-purple transition-all duration-500"
              style={{ width: `${(stats.mastered / stats.total * 100).toFixed(1)}%` }}
            ></div>
          </div>
          <div className="text-right text-xs text-cyber-blue mt-1 font-bold">
            {((stats.mastered / stats.total) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="absolute top-24 right-6 bg-cyber-dark bg-opacity-80 backdrop-blur-md border border-cyber-purple rounded-lg p-4 shadow-neon-pink">
        <h3 className="text-cyber-purple font-bold mb-3 text-lg">🎨 技能分类</h3>
        <div className="space-y-2">
          {skillData.categories.map(cat => (
            <div key={cat.id} className="flex items-center space-x-2 text-sm">
              <div 
                className="w-4 h-4 rounded-full shadow-md"
                style={{ 
                  backgroundColor: cat.color,
                  boxShadow: `0 0 10px ${cat.color}`
                }}
              ></div>
              <span className="text-gray-300">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 控制面板 */}
      <div className="absolute bottom-6 right-6 flex flex-col space-y-3">
        <button
          onClick={exportProgress}
          className="px-6 py-3 bg-cyber-blue bg-opacity-20 border border-cyber-blue text-cyber-blue rounded-lg hover:bg-opacity-30 transition-all duration-300 shadow-neon-blue backdrop-blur-sm font-bold"
        >
          💾 导出进度
        </button>
        
        <label className="px-6 py-3 bg-cyber-purple bg-opacity-20 border border-cyber-purple text-cyber-purple rounded-lg hover:bg-opacity-30 transition-all duration-300 shadow-neon-pink backdrop-blur-sm font-bold cursor-pointer text-center">
          📂 导入进度
          <input
            type="file"
            accept=".json"
            onChange={importProgress}
            className="hidden"
          />
        </label>
        
        <button
          onClick={resetProgress}
          className="px-6 py-3 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 rounded-lg hover:bg-opacity-30 transition-all duration-300 backdrop-blur-sm font-bold"
        >
          🔄 重置进度
        </button>
      </div>

      {/* 节点详情面板 */}
      {selectedNode && (
        <div className="absolute bottom-6 left-6 max-w-md bg-cyber-dark bg-opacity-90 backdrop-blur-md border-2 rounded-lg p-5 shadow-2xl animate-fadeIn"
          style={{ borderColor: skillData.categories.find(c => c.id === selectedNode.category)?.color || '#00f2ff' }}
        >
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-2xl font-bold" style={{ 
              color: skillData.categories.find(c => c.id === selectedNode.category)?.color 
            }}>
              {selectedNode.name}
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-500 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">状态:</span>
              <span className={`font-bold ${
                selectedNode.status === 'mastered' ? 'text-cyan-400' :
                selectedNode.status === 'unlocked' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {selectedNode.status === 'mastered' ? '✨ 已掌握' :
                 selectedNode.status === 'unlocked' ? '🔓 可学习' : '🔒 未解锁'}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">分类:</span>
              <span className="text-white">
                {skillData.categories.find(c => c.id === selectedNode.category)?.name}
              </span>
            </div>
            
            <div className="pt-3 border-t border-gray-700">
              <p className="text-gray-300 leading-relaxed">{selectedNode.desc}</p>
            </div>
            
            {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 && (
              <div className="pt-3 border-t border-gray-700">
                <div className="text-gray-400 mb-2">前置技能:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.prerequisites.map(prereqId => {
                    const prereq = skillData.nodes.find(n => n.id === prereqId);
                    return prereq ? (
                      <span key={prereqId} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                        {prereq.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillTree;
