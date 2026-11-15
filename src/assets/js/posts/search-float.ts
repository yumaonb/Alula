// search-float.ts — 行级常驻搜索浮层：摆位几何 + 显隐落位（无出入场动画）
// 用法：const floatCtl = createSearchFloat({ row })
//
// CSS 只管 visibility / pointer-events（随行变体类瞬时翻转）+ 端点 opacity: 0；
// opacity 在这里按目标态直接落位（切页不播动画，见 ARCHITECTURE.md 脚本职责表）

export interface SearchFloatEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
}

export interface SearchFloatCtl {
  /** 当前显隐目标态（只读） */
  readonly state: 'shown' | 'hidden';
  el(): HTMLElement | null;
  /** 直接落位到目标态：清残留内联可见态、把 opacity 钉到目标值（不播动画） */
  settle(show: boolean): void;
}

/** 把浮层摆到页头占位符（`.posts-header-search`）的位置：写行相对 top / left / width。
 *
 *  从占位符沿 offset 链累加到行：offset* 是布局坐标，不受 #swup 切页转场的
 *  translateY 影响（见 TROUBLESHOOTING 42），静止 / 进入期量出的都是同一布局值，
 *  无需量 rect 或减位移。JS 运行前的基线位是 global.css 的占位重合值（CSS 基线
 *  的跨文件契约见该文件 .posts-search-float 注释），本函数只负责运行时覆写。 */
export function placeFloat(r: HTMLElement, ph: HTMLElement, f: HTMLElement): void {
  let top = 0;
  let left = 0;
  let el: HTMLElement | null = ph;
  while (el && el !== r) {
    top += el.offsetTop;
    left += el.offsetLeft;
    el = el.offsetParent as HTMLElement | null;
  }
  // 链中途断掉（隐藏祖先）时不写错值
  if (el !== r) return;
  f.style.top = `${top}px`;
  f.style.left = `${left}px`;
  f.style.width = `${ph.offsetWidth}px`;
  f.style.right = 'auto';
}

export function createSearchFloat(env: SearchFloatEnv): SearchFloatCtl {
  let state: 'shown' | 'hidden' = 'hidden';

  const ctl: SearchFloatCtl = {
    get state(): 'shown' | 'hidden' {
      return state;
    },

    el(): HTMLElement | null {
      return env.row()?.querySelector<HTMLElement>('.posts-search-float') ?? null;
    },

    /** 直接落位：清掉残留内联可见态（首帧脚本写过的 visible），把 opacity 钉到目标值；
     *  visibility 不写内联，随行变体类走 CSS 瞬时翻转（列表变体显示、其他隐藏） */
    settle(show: boolean): void {
      const f = this.el();
      if (f) {
        f.style.visibility = '';
        f.style.opacity = show ? '1' : '0';
      }
      state = show ? 'shown' : 'hidden';
    },
  };

  return ctl;
}
