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
 *  必须用与 transform 无关的布局坐标：getBoundingClientRect 含 transform 位移，
 *  按它量会把错值写进内联且不再被重测（transform 不改变锚的尺寸）；占位符与槽
 *  静止无位移，rect 即布局坐标。
 *
 *  首帧另有一份等价实现（BaseLayout.astro 的搜索框首帧内联脚本）：那段 `is:inline`
 *  不过构建期处理、不能 import，只能复制，改这里要同步改那边。 */
export function placeFloat(r: HTMLElement, ph: HTMLElement, f: HTMLElement): void {
  const b = r.getBoundingClientRect();
  const slot = ph.closest<HTMLElement>('.posts-edge-slot');
  if (slot) {
    const s = slot.getBoundingClientRect();
    f.style.top = `${s.top - b.top + ph.offsetTop}px`;
    f.style.left = `${s.left - b.left + ph.offsetLeft}px`;
  } else {
    const a = ph.getBoundingClientRect();
    f.style.top = `${a.top - b.top}px`;
    f.style.left = `${a.left - b.left}px`;
  }
  f.style.width = `${ph.offsetWidth}px`;
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
