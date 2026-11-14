// edge-float.ts — 左缘条常驻盒（.posts-edge-float）内容同步：把驱动条深克隆进盒
// 用法：const edgeFloat = createEdgeFloat({ row }); 由 posts/posts-shell.ts 引入，
// 首屏初始化与每次 swup:content:replace 后各跑一次 sync()
//
// 页头 / 面包屑的显示实例在行级常驻盒（#swup 外、swup 永不重建）：跨区切页整盒随
// page-exit / page-enter 曲线，区内切页盒不位移、车道（.posts-edge-content）原地
// 模糊渐隐渐显（动效见 global.css「切页转场」）。#swup 里的驱动条只留布局空间
// （搜索浮层叠放测算、锚高度观察）+ 无 JS 回退显示；克隆换入后行加 is-edge-live
// 把驱动条隐掉（visibility 不影响布局，测算与观察仍照读驱动条）。

export interface EdgeFloatEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
}

export interface EdgeFloatCtl {
  /** 用当前驱动条的克隆换掉盒内容（无驱动条的页面清空盒），并翻行上的 is-edge-live */
  sync(): void;
}

// 驱动条两种（列表页头 / 文章面包屑），见 layouts/PostsShell.astro 的两个驱动槽
const DRIVER_SELECTOR =
  'main#swup .posts-edge-slot > .posts-header, main#swup .posts-edge-slot > .posts-breadcrumb';

export function createEdgeFloat(env: EdgeFloatEnv): EdgeFloatCtl {
  function sync(): void {
    const r = env.row();
    const box = r?.querySelector<HTMLElement>('.posts-edge-float') ?? null;
    if (!r || !box) return;
    const driver = r.querySelector<HTMLElement>(DRIVER_SELECTOR);
    if (!driver) {
      box.replaceChildren();
      r.classList.remove('is-edge-live');
      return;
    }
    // 深克隆只承载显示；摘掉锚属性，让行内 [data-posts-anchor] 只命中驱动条
    const clone = driver.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    clone.classList.add('posts-edge-content');
    box.replaceChildren(clone);
    r.classList.add('is-edge-live');
  }

  return { sync };
}
