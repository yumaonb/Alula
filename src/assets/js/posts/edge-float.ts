// edge-float.ts — 左缘条常驻盒（.posts-edge-float）内容同步：把驱动条深克隆进盒
// 用法：const edgeFloat = createEdgeFloat({ row }); 由 posts/posts-shell.ts 引入，
// 首屏初始化与每次 swup:content:replace 后各跑一次 sync(regionLanding)
//
// 页头 / 面包屑的显示实例在行级常驻盒（#swup 外、swup 永不重建）：跨区切页整盒随
// page-exit / page-enter 曲线，区内切页盒不位移、车道等新页落地才变（fetch 等待期
// 旧车道保持可见、不空场）：content:replace 后给旧车道标 is-edge-out 播渐模糊，
// 播完换入新克隆带 is-edge-in 播去模糊（动效见 global.css「切页转场」）。
// #swup 里的驱动条只留布局空间
// （搜索浮层叠放测算、锚高度观察）+ 无 JS 回退显示；克隆换入后行加 is-edge-live
// 把驱动条隐掉（visibility 不影响布局，测算与观察仍照读驱动条）。

export interface EdgeFloatEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
}

export interface EdgeFloatCtl {
  /** 用当前驱动条的克隆换掉盒内容（无驱动条的页面清空盒），并翻行上的 is-edge-live。
   * regionLanding：本次落地是否区内转场落地（posts-shell.ts 按 still 标记 + is-rendering 期判）；
   * 为真且盒内有旧车道时先播渐模糊再换入，否则立即换 */
  sync(regionLanding: boolean): void;
}

// 驱动条两种（列表页头 / 文章面包屑），见 layouts/PostsShell.astro 的两个驱动槽
const DRIVER_SELECTOR =
  'main#swup .posts-edge-slot > .posts-header, main#swup .posts-edge-slot > .posts-breadcrumb';

/** 读元素计算动画时长（毫秒），解析失败兜底 400ms */
function animationMs(el: HTMLElement): number {
  const ms = parseFloat(getComputedStyle(el).animationDuration) * 1000;
  return Number.isFinite(ms) ? ms : 400;
}

export function createEdgeFloat(env: EdgeFloatEnv): EdgeFloatCtl {
  // 换舞序号：连切时使上一轮 dance 的换入回调作废，以最后一次落地为准
  let dance = 0;

  function buildClone(driver: HTMLElement): HTMLElement {
    // 深克隆只承载显示；摘掉锚属性，让行内 [data-posts-anchor] 只命中驱动条
    const clone = driver.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    clone.classList.add('posts-edge-content');
    return clone;
  }

  function sync(regionLanding: boolean): void {
    const r = env.row();
    const box = r?.querySelector<HTMLElement>('.posts-edge-float') ?? null;
    if (!r || !box) return;
    const driver = r.querySelector<HTMLElement>(DRIVER_SELECTOR);
    const clone = driver ? buildClone(driver) : null;
    r.classList.toggle('is-edge-live', clone !== null);
    const old = box.querySelector<HTMLElement>('.posts-edge-content');

    // 区内转场落地：旧车道先播完渐模糊再换入克隆，fetch 等待期车道保持可见。
    // 跨区 / popstate / 首屏立即换，视觉行为不变
    if (!regionLanding || old === null) {
      if (clone) box.replaceChildren(clone);
      else box.replaceChildren();
      return;
    }
    dance += 1;
    const token = dance;
    const swap = (): void => {
      if (token !== dance || !old.isConnected) return;
      if (clone) box.replaceChildren(clone);
      else box.replaceChildren();
      clone?.classList.add('is-edge-in');
    };
    // 先摘去模糊类，避免 is-edge-in 与 is-edge-out 同车道共存
    old.classList.remove('is-edge-in');
    old.classList.add('is-edge-out');
    const onOutEnd = (e: Event): void => {
      if (e.target !== old) return;
      old.removeEventListener('animationend', onOutEnd);
      swap();
    };
    old.addEventListener('animationend', onOutEnd);
    // 兜底：时长 + 余量到点强制换入（防 animationend 丢失）
    window.setTimeout(swap, animationMs(old) + 100);
  }

  return { sync };
}
