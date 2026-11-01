// search-float.ts — 行级常驻搜索浮层：摆位几何 + 出入场状态机
// 用法：const floatCtl = createSearchFloat({ row, track, stopAnims, isMobile, reduceMotion })
//
// CSS 只管 visibility / pointer-events（随行变体类瞬时翻转）+ 端点 opacity: 0；
// opacity / 位移 / 白纱全在这里。白纱规则：**淡出与淡入都用**（容器背景 透明 ↔ VEIL）——
// 移动渐隐的毛玻璃用实体白替代消失的模糊；淡入：入场前先加上半透明白（同任务 pre-pin、
// 无绘制间隙），再随入场全程褪去（白纱 / 淡变只用于区内动画；跨区边界直接 settle，无动画）。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

import { readTranslate } from '../util/dom';
import { EASE, EASE_ENTRY, EASE_EXIT, PHASE_MS } from './transition-tokens';

// 搜索「移一段」的位移距离
const SEARCH_DX = 48;
// 手机端（≤768px）搜索位移与渐隐时长（退场上移与整页推入同缓动、时长按位移距离等比；
// 位移必须小于手机端列式页头的标题↔搜索间隙 16px，否则入场落回会蹭到标题底边闪一下）
const FLOAT_MOVE = 12;
// 退场上移时长（= 渐显时长；更短会快得失真、观感「无退场动画」）
const FLOAT_EXIT_MOVE_MS = 100;
// 入场落回时长（关文章，搜索自上方落回，与位移完成同时落定）
const FLOAT_ENTRY_MOVE_MS = 50;
// 入场渐显（110 + 110 = 220ms 收尾）
const FLOAT_ENTRY_FADE_MS = 110;
// 手机端「关文章」：搜索自上方落回的延迟（避免下移时叠在文章卡片上）。
// 整页自上方 48px 推下时，列表栅格顶（160.6 - 48 = 112.6）起初在搜索框钉住位底边（146.6）
// 之上；新曲线（200ms 位移）栅格顶 ≈95ms 即越过胶囊底边，保留 110ms 作安全余量
// （150ms 明显偏慢）；110 + 50 = 160ms，先于推入位移完成落定
const FLOAT_ENTRY_DELAY_MS = 110;
// 白纱关键帧的透明端（与 .glass 的 transparent 等价）
const BG0 = 'rgba(255, 255, 255, 0)';
const VEIL = (() => {
  try {
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--glass-veil').trim() ||
      'rgba(255, 255, 255, 0.15)'
    );
  } catch {
    return 'rgba(255, 255, 255, 0.15)';
  }
  // 白纱令牌（variables.css --glass-veil）：移动渐隐的毛玻璃用它替代模糊
})();

export interface SearchFloatEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
  /** 登记浮层动画：生命周期由外层统一 cancel（切页清场时不用逐条记） */
  track: (a: AnimationPlaybackControls) => AnimationPlaybackControls;
  /** 停掉浮层生命周期的全部动画 */
  stopAnims: () => void;
  isMobile: () => boolean;
  reduceMotion: boolean;
}

export interface SearchFloatCtl {
  state: 'shown' | 'hidden' | 'exiting' | 'entering';
  active: AnimationPlaybackControls | null;
  el(): HTMLElement | null;
  settle(show: boolean): void;
  finish(show: boolean, f: HTMLElement): void;
  allFinished(f: HTMLElement, show: boolean, anims: AnimationPlaybackControls[]): void;
  exitMobile(): AnimationPlaybackControls | null;
  exitDesktop(withX: boolean): AnimationPlaybackControls | null;
  enterMobile(): void;
  enterDesktop(withX: boolean): void;
  redirect(show: boolean): AnimationPlaybackControls | null;
}

/** 槽**自身 + 槽到行之间祖先**的 transform y 位移和：手机端整页推拉移动的是槽的祖先
 *  （内容根），条带模糊变过去里槽自身还会做等距反推（counter）——getBoundingClientRect
 *  含这些位移，量之前全部减去还原布局坐标，转场途中任意时刻量都是对的；静止时恒 0 */
function slotAncestorTy(slot: HTMLElement, r: HTMLElement): number {
  let sum = 0;
  let e: HTMLElement | null = slot;
  while (e && e !== r && e !== document.body) {
    sum += readTranslate(e).y;
    e = e.parentElement;
  }
  return sum;
}

/** 把浮层摆到页头占位符（`.posts-header-search`）的位置：写行相对 top / left / width。
 *
 *  必须用与 transform 无关的布局坐标：锚的 ResizeObserver 首次回调可能赶在推入 / 反推
 *  动画途中，getBoundingClientRect 含动画位移，按它量会把错值写进内联且不再被重测
 *  （transform 不改变锚的尺寸）——所以量完要减去 slotAncestorTy 还原。
 *
 *  首帧另有一份等价实现（BaseLayout.astro 的搜索框首帧内联脚本）：那段 `is:inline`
 *  不过构建期处理、不能 import，只能复制，改这里要同步改那边（首帧无 transform，
 *  所以那边不减 slotAncestorTy）。 */
export function placeFloat(r: HTMLElement, ph: HTMLElement, f: HTMLElement): void {
  const b = r.getBoundingClientRect();
  const slot = ph.closest<HTMLElement>('.posts-edge-slot');
  if (slot) {
    const s = slot.getBoundingClientRect();
    const ty = slotAncestorTy(slot, r);
    f.style.top = `${s.top - b.top - ty + ph.offsetTop}px`;
    f.style.left = `${s.left - b.left + ph.offsetLeft}px`;
  } else {
    const a = ph.getBoundingClientRect();
    f.style.top = `${a.top - b.top}px`;
    f.style.left = `${a.left - b.left}px`;
  }
  f.style.width = `${ph.offsetWidth}px`;
}

export function createSearchFloat(env: SearchFloatEnv): SearchFloatCtl {
  // 浮层钉视口期间的原行相对内联 top / left（unpin 时恢复）
  let pinSaved: { top: string; left: string } | null = null;

  /** 浮层钉视口：absolute → fixed 钉到当前视口位置，退场动画期间脱离页面滚动——
   *  切页后 SwupScrollPlugin 平滑滚回顶部，文档坐标里的浮层会被滚动「带走」，
   *  退场变成向右下的斜线（目录克隆也要钉视口）。行及其祖先无 transform / filter，
   *  fixed 即视口坐标。用途：退场（桌面 / 移动）起播前钉、动画播完（opacity 0）
   *  或静态归位（settle）时恢复，恢复不可见；移动端入场先钉、落回延迟结束
   *  （渐显刚起、近不可见）即 unpin（见 enterMobile）。桌面端入场不钉——落回跟随内容，
   *  钉了会在滚顶在途时于动画收尾还原行相对位置处跳一次（见 enterDesktop） */
  function pinFloat(f: HTMLElement): void {
    // 已在钉住态（redirect 中途被改向）
    if (f.style.position === 'fixed') return;
    pinSaved = { top: f.style.top, left: f.style.left };
    const r = f.getBoundingClientRect();
    f.style.position = 'fixed';
    f.style.top = `${r.top}px`;
    f.style.left = `${r.left}px`;
  }

  function unpinFloat(f: HTMLElement): void {
    if (f.style.position !== 'fixed') return;
    f.style.position = '';
    f.style.top = pinSaved?.top ?? '';
    f.style.left = pinSaved?.left ?? '';
    pinSaved = null;
  }

  /** 读浮层当前位姿 = 最后一帧渲染值：在途位姿只能从 computed style 读——
   *  motion 的 cancel 会把元素回退到首关键帧（keyframes[0] 重写进内联），
   *  cancel 之后内联里已不是在途值（nav-indicator 的 currentX 同口径）。
   *  transform 按平移分量解析（readTranslate 兼容 matrix / matrix3d）；opacity 取不到按 1 */
  function readFloatPose(f: HTMLElement): { dx: number; dy: number; op: number; bg: string } {
    const cs = getComputedStyle(f);
    const { x: dx, y: dy } = readTranslate(f);
    const o = parseFloat(cs.opacity);
    return { dx, dy, op: Number.isFinite(o) ? o : 1, bg: cs.backgroundColor || BG0 };
  }

  const ctl: SearchFloatCtl = {
    state: 'shown',
    active: null,

    el(): HTMLElement | null {
      return env.row()?.querySelector<HTMLElement>('.posts-search-float') ?? null;
    },

    /** 钉到静态目标态：清掉一切内联（transform / opacity / visibility / 背景白纱 + 视口钉） */
    settle(show: boolean): void {
      env.stopAnims();
      this.active = null;
      this.state = show ? 'shown' : 'hidden';
      const f = this.el();
      if (!f) return;
      unpinFloat(f);
      f.style.transform = '';
      f.style.visibility = '';
      f.style.backgroundColor = '';
      f.style.opacity = show ? '1' : '0';
    },

    /** 幂等收尾：只在所有出入场动画都播完后被调用（allFinished 计数）；
     *  清掉一切内联回到静态目标态。若让先结束者收尾，它清的 visibility / transform 内联
     *  会让变体类（如文章页隐藏浮层）提前生效——后结束动画的尾巴就播给用户看漏了 */
    finish(show: boolean, f: HTMLElement): void {
      this.state = show ? 'shown' : 'hidden';
      this.active = null;
      // 动画播完：脱离视口钉，回到行内绝对定位（两条入场路径此处均 no-op：移动端入场
      // 落回延迟中已解除、桌面端入场从不钉；退场以 opacity 0 收尾，还原不可见）
      unpinFloat(f);
      f.style.visibility = '';
      f.style.transform = '';
      f.style.backgroundColor = '';
      f.style.opacity = show ? '1' : '0';
    },

    /** 计数收尾：全部入参动画播完才 finish（被 cancel 的不会计数，收尾交给后续 settle / 新动画） */
    allFinished(f: HTMLElement, show: boolean, anims: AnimationPlaybackControls[]): void {
      let done = 0;
      const tick = (): void => {
        if (++done === anims.length) this.finish(show, f);
      };
      for (const a of anims) a.finished.then(tick).catch(() => {});
    },

    /** 手机端「开文章」退场：上移（同推入速度）+ 渐隐 + 白纱。after-swap 时触发 */
    exitMobile(): AnimationPlaybackControls | null {
      if (this.state !== 'shown') return this.active;
      const f = this.el();
      if (!f) return null;
      // 清掉任何残留内联（幂等起点）
      this.settle(true);
      this.state = 'exiting';
      // 变体类可能已隐藏容器（swap 先于动画结束）——退出窗口内强制可见
      f.style.visibility = 'visible';
      // 退场动画期间钉视口：滚顶滑行不会把上移 + 渐隐「带走」成斜线
      pinFloat(f);
      const move = env.track(
        animate(
          f,
          { y: [0, `-${FLOAT_MOVE}px`] },
          {
            duration: FLOAT_EXIT_MOVE_MS / 1000,
            ease: EASE,
            reduceMotion: env.reduceMotion,
            autoplay: false,
          },
        ),
      );
      const fade = env.track(
        animate(
          f,
          { opacity: [1, 0], backgroundColor: [BG0, VEIL] },
          {
            duration: FLOAT_EXIT_MOVE_MS / 1000,
            ease: EASE_EXIT,
            reduceMotion: env.reduceMotion,
            autoplay: false,
          },
        ),
      );
      this.active = move;
      this.allFinished(f, false, [move, fade]);
      return move;
    },

    /** 桌面端退场：右移 48px（配对目录入场时）+ 渐隐 + 白纱；无配对只渐隐 */
    exitDesktop(withX: boolean): AnimationPlaybackControls | null {
      if (this.state !== 'shown') return this.active;
      const f = this.el();
      if (!f) return null;
      // 清掉任何残留内联（幂等起点）
      this.settle(true);
      this.state = 'exiting';
      // 变体类已先隐藏容器——退出窗口内强制可见
      f.style.visibility = 'visible';
      // 退场动画期间钉视口：滚顶滑行不会把右移 + 渐隐「带走」成向右下的斜线
      pinFloat(f);
      const opts = {
        duration: PHASE_MS / 1000,
        ease: EASE_EXIT,
        reduceMotion: env.reduceMotion,
        autoplay: false,
      };
      const move = withX ? env.track(animate(f, { x: [0, `${SEARCH_DX}px`] }, opts)) : null;
      const fade = env.track(animate(f, { opacity: [1, 0], backgroundColor: [BG0, VEIL] }, opts));
      // 相位链到整体退场（位移与渐隐同时长，链谁等效）
      this.active = move ?? fade;
      this.allFinished(f, false, move ? [move, fade] : [fade]);
      return move;
    },

    /** 手机端「关文章」入场：自上方偏移落回 + 渐显 + 白纱（入场前先铺白、随入场全程褪去） */
    enterMobile(): void {
      const f = this.el();
      if (!f || this.state !== 'hidden') return;
      this.settle(false);
      this.state = 'entering';
      // 入场动画期间钉视口（先于 pre-pin transform：量盒须取无位移的自然位）
      pinFloat(f);
      f.style.transform = `translateY(-${FLOAT_MOVE}px)`;
      f.style.opacity = '0';
      // 入场前先加上半透明白，关键帧随入场全程褪去
      f.style.backgroundColor = VEIL;
      // 落回延迟（FLOAT_ENTRY_DELAY_MS）：等整页推下把栅格顶移过胶囊底边再下移，
      // 可见帧不叠卡片（钉住位 opacity 0，延迟期不可见）
      const delay = FLOAT_ENTRY_DELAY_MS / 1000;
      // 延迟一结束即解除视口钉：落回期间浮层行内绝对定位、真正跟着内容走（fixed 钉
      // 不随推入移动，内容快而浮层慢会显得「不跟着文章走」）；unpin 的胶囊重合成落在
      // 渐显进行中，即使挤栅格预算单帧也被 alpha 覆盖（TROUBLESHOOTING 51）
      window.setTimeout(() => {
        if (this.state === 'entering') unpinFloat(f);
      }, FLOAT_ENTRY_DELAY_MS);
      const move = env.track(
        animate(
          f,
          { y: [`-${FLOAT_MOVE}px`, 0] },
          {
            duration: FLOAT_ENTRY_MOVE_MS / 1000,
            delay,
            ease: EASE_ENTRY,
            reduceMotion: env.reduceMotion,
            autoplay: false,
          },
        ),
      );
      const fade = env.track(
        animate(
          f,
          { opacity: [0, 1], backgroundColor: [VEIL, BG0] },
          {
            duration: FLOAT_ENTRY_FADE_MS / 1000,
            delay,
            ease: EASE_ENTRY,
            reduceMotion: env.reduceMotion,
            autoplay: false,
          },
        ),
      );
      this.active = move;
      this.allFinished(f, true, [move, fade]);
    },

    /** 桌面端入场：自右偏移 48px 落回（配对目录退场时）+ 渐显 + 白纱；无配对只渐显。
     *  不钉视口：落回跟随内容（行内绝对定位，与移动端入场落回同范式）——切页后滚顶滑行
     *  可能仍在途，钉视口会把胶囊冻结在钉住时刻的视口位、页头随页面落定在视口下移，
     *  动画收尾行相对位置时胶囊会跳一次 */
    enterDesktop(withX: boolean): void {
      const f = this.el();
      if (!f || this.state !== 'hidden') return;
      // 清掉任何残留内联（幂等起点）
      this.settle(false);
      this.state = 'entering';
      const opts = {
        duration: PHASE_MS / 1000,
        ease: EASE_ENTRY,
        reduceMotion: env.reduceMotion,
        autoplay: false,
      };
      // 位姿先内联写好再起播（同任务内无绘制间隙，不闪）
      if (withX) f.style.transform = `translateX(${SEARCH_DX}px)`;
      f.style.opacity = '0';
      // 入场前先加上半透明白，关键帧随入场全程褪去
      f.style.backgroundColor = VEIL;
      const move = withX ? env.track(animate(f, { x: [`${SEARCH_DX}px`, 0] }, opts)) : null;
      const fade = env.track(animate(f, { opacity: [0, 1], backgroundColor: [VEIL, BG0] }, opts));
      this.active = move ?? fade;
      this.allFinished(f, true, move ? [move, fade] : [fade]);
    },

    /** 快速连切：在途相位（退场 / 入场）被新一轮切页打断时，不静默掐断硬切——
     *  从飞行中位姿改向到本轮目的地的静止态（与目录克隆的中断处理同范式：停下、
     *  再走完整动效）：退场未完就切回列表 → 自当前位置归位（「停下再回去」）；
     *  入场未完就切进文章 → 自当前位置继续离场，补完退场动画。
     *  飞行中位姿只能从 computed style（最后一帧渲染值）读：motion 的 cancel 会把
     *  元素回退到首关键帧（把 keyframes[0] 重写进内联），cancel 之后内联里已不是
     *  在途位姿——与 nav-indicator 快速连点改向同范式（先读 computed 再改向）。
     *  时长按剩余位移 / 剩余渐隐占全程的比例折算（25%–100%） */
    redirect(show: boolean): AnimationPlaybackControls | null {
      const f = this.el();
      if (!f || (this.state !== 'exiting' && this.state !== 'entering')) return this.active;
      // 先读：cancel 会把内联改写回首关键帧
      const { dx, dy, op, bg } = readFloatPose(f);
      env.stopAnims();
      // 重钉在途位姿：cancel 改写的首关键帧位姿不可暴露——延迟期 motion 不写帧，
      // 元素会停在内联值上直到动画首帧
      f.style.transform = `translate(${dx}px, ${dy}px)`;
      f.style.opacity = `${op}`;
      f.style.backgroundColor = bg;
      // 行变体已翻走隐藏容器——补完退场窗口内强制可见（同 exitDesktop）
      if (!show) f.style.visibility = 'visible';
      const mobile = env.isMobile();
      const tx = show ? 0 : mobile ? 0 : SEARCH_DX;
      const ty = show ? 0 : mobile ? -FLOAT_MOVE : 0;
      // 剩余量：主轴位移余量与透明度余量取大，夹在 25%–100% 全程之间
      const axisLeft = show
        ? mobile
          ? Math.abs(dy)
          : Math.abs(dx)
        : mobile
          ? Math.abs(-FLOAT_MOVE - dy)
          : Math.abs(SEARCH_DX - dx);
      const full = mobile ? FLOAT_MOVE : SEARCH_DX;
      const opLeft = show ? 1 - op : op;
      const frac = Math.min(1, Math.max(0.25, Math.max(axisLeft / full, opLeft)));
      // 手机端归位与 enterMobile 同样延迟：等整页推下把栅格顶移过胶囊底边再落回，
      // 可见帧不叠卡片
      const delay = mobile && show ? FLOAT_ENTRY_DELAY_MS / 1000 : 0;
      const a = env.track(
        animate(
          f,
          {
            x: [`${dx}px`, `${tx}px`],
            y: [`${dy}px`, `${ty}px`],
            opacity: [op, show ? 1 : 0],
            backgroundColor: [bg, show ? BG0 : VEIL],
          },
          {
            duration: (PHASE_MS * frac) / 1000,
            delay,
            ease: show ? EASE_ENTRY : EASE_EXIT,
            reduceMotion: env.reduceMotion,
            autoplay: false,
          },
        ),
      );
      this.state = show ? 'entering' : 'exiting';
      this.active = a;
      a.finished.then(() => this.finish(show, f)).catch(() => {});
      return a;
    },
  };

  return ctl;
}
