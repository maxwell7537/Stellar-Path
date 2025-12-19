// 注册中心：按顺序导出所有星座配置
import ctf from './tree_ctf.json';
import csBase from './tree_cs_base.json';
import frontend from './tree_frontend.json';
import python from './tree_python.json';
import java from './tree_java.json';
import devops from './tree_devops.json';
import security from './tree_security.json';

// 导出数组，UI 会基于此数组进行轮播展示
export const constellationRegistry = [
  ctf,
  csBase,
  frontend,
  python,
  java,
  devops,
  security
];

export default constellationRegistry;
