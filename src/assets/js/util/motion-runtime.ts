// motion-runtime.ts — motion 的最小再导出面（只给懒加载入口用）
// 用法：只由 util/motion.ts 动态 import，业务代码不要直接引本文件
//
// 为什么单独一层：`import('motion')` 拿到的是整个命名空间，Rollup 无法
// tree-shake，会把 motion 全量（143 KB）打进分块；改成本文件只再导出
// 实际用到的两个函数（animate / stagger），打包结果回到 54 KB。
export { animate, stagger } from 'motion';
