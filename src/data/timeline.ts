// timeline.ts — 关于页「历程」时间轴配置
// 用法：import { timeline } from "../../data/timeline"
// 条目顺序随意，组件按 date 升序排列；date 用 YYYY-MM-DD。

export interface TimelineEntry {
  date: string;
  title: string;
  description: string;
}

export const timeline: TimelineEntry[] = [
  {
    date: '2024-03-23',
    title: '搭建首个个人网站',
    description: '在他人协助下完成首个站点搭建，由此点燃对 Web 技术与互联网底层逻辑的兴趣。',
  },
  {
    date: '2024-06-08',
    title: '涉足商业级项目与运维实战',
    description:
      '合作完成首个商业级网站，并在此阶段深入钻研 Linux 运维与 Nginx 配置，打下坚实底层基础。',
  },
  {
    date: '2024-10-15',
    title: '主导运营 IDC 与多产品线业务',
    description:
      '作为核心主导者，与合伙人共同操盘包含 IDC 服务器、虚拟主机及二级域名分发在内的真实业务矩阵，积累了丰富的用户运营与高并发故障处理经验。',
  },
  {
    date: '2025-02-25',
    title: '组建首个技术团队',
    description: '发起并组建「羽毛工作室」，标志着从双人合伙模式向规范化团队协作与项目管理转型。',
  },
  {
    date: '2026-01-29',
    title: '全面关停业务线并沉淀技术',
    description:
      '在业务运营中主动排查出合规隐患，果断全面关停原有业务线。并借此契机系统补齐互联网法律法规知识，完成思维重塑，全面转入底层技术沉淀。',
  },
  {
    date: '2026-03-01',
    title: '向前后端全栈领域进军',
    description: '在夯实运维底座后，正式切入前端核心领域，打通从网络底层到用户界面的全链路技术栈。',
  },
  {
    date: '2026-03-22',
    title: '组建「微码筑梦团队」',
    description: '发起成立第二支团队，探索更成熟的敏捷开发模式与全栈项目实战。',
  },
  {
    date: '2026-09-01',
    title: '深入前端工程化与框架生态',
    description:
      '熟练掌握 Astro / Svelte 等现代框架，深度融合 AI 工作流大幅提升开发效率，完成从「手写代码」向「系统架构设计」的认知跃迁。',
  },
];
