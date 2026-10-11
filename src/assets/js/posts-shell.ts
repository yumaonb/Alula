// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts-shell"
//
// 侧边栏（GlobalSidebar）与搜索框（PostSearch）都在 #swup 之外、切页不重建，
// 所以每次切页后五件事要自己跟上：
// ① 行的变体类（--plain/--listing/--post，驱动侧栏/搜索显隐与内容列 1000px 收窄）；
// ② 侧栏顶偏移 --posts-side-offset（实测「页锚高度 + 间隙」，页锚 = 页头 / 面包屑条）；
// ③ 侧栏高亮态（当前分类高亮 + 其路径补展开、当前标签高亮）；
// ④ 行级常驻搜索框的叠放位置（实测页头占位符 .posts-header-search 的行内坐标）；
// ⑤ 切页转场（motion 驱动，只在文章区界面之间生效；涉及普通屏不播）。
//
// ---- 转场机制 ----
// a) 左缘元素条带切换（列表页头 ↔ 文章面包屑条）：swup 替换瞬间丢弃旧 DOM，替换前
//    （astro:before-swap，即 content:replace 前一刻）克隆旧元素进行内**静止暂存**，
//    等新界面加载完（astro:after-swap）才播放——过渡绝不先于内容。**全部**左缘条带
//    切换（桌面端所有 + 手机端列表↔文章 + 手机端列表↔分类/标签；用户指定电脑端也用
//    模糊，手机端滑动形态随之整体退役）走**模糊变过去**——旧带原地模糊渐隐
//    （blur 0→4px + opacity 1→0，160ms）、新带原地模糊渐显（blur 4px→0 + opacity 0→1，
//    260ms），两带同位交叉渐隐、无双重曝光。手机端列表↔文章另做**固定方向**整页推拉：
//    开文章 = 整页向上（新内容自下方 48px 滑入）、关文章 = 镜像向下（新列表自上方 48px
//    滑下）——新带槽另做与推入**等距反向**的 counter 位移，屏幕上原地不动——避免新带
//    跟随推入上滑显得「面包屑浮上去」，读起来是「标题模糊成面包屑」。
// b) 搜索/目录退场配对（用户要求「先退场再入场」）：目录出现/消失的切页里，退出相位
//    （240ms）走完才播进入相位（320ms）——列表→文章：搜索右移 48px「移一段」渐隐
//    （退出）→ 目录自屏幕右缘左移渐显（入场）；文章→列表：目录右移移出屏幕渐隐
//    （退出）→ 搜索自 48px 右偏移左移渐显（入场）。只在电脑端显示目录（≥851px）时
//    带位移；文章↔文章保持 400ms 并行交叉渐隐。目录的渐显/渐隐与位移解耦：入场渐显
//    延迟 80ms 起（位移先走）、出场渐隐 140ms 快于位移（先淡净再带走）——位移节奏
//    参照搜索框移动切换（用户要求：入场渐显延迟一点、出场渐隐更快）。
// c) 手机端（≤768px）列表↔文章：搜索框**点击即退场**（委托 click 监听，不等内容加载）：
//    上移 + 渐隐（渐隐比位移快，避免与上方标题视觉冲突）；新内容自下方 48px 滑入
//    （开文章）/ 新列表自上方 48px 滑下（关文章），搜索框自上方偏移落回渐显。
//    条带交换走模糊变过去（旧带模糊渐隐 + 新带反推后原地模糊渐显，见 a）。
//    **跨区（列表 ↔ 普通页）不做搜索淡变**：去普通页直接消失（点击即 settle）、
//    从普通页回来直接出现（after-swap settle）——只有区内（列表↔详情）做退场/入场淡变（用户指定）
//    白纱规则（移动渐隐的毛玻璃通用，见 CSS.md「玻璃拟态」）：搜索胶囊是磨砂（backdrop
//    模糊、背景全透明），渐隐时模糊随透明度一起淡掉会「突然变透明」——搜索**淡出**同时
//    把**容器**背景在 透明 ↔ --glass-veil（半透明白纱，variables.css 令牌）之间过渡，
//    用实体白替代消失的模糊。**淡入也铺白纱**：入场**前**先加上半透明白（入场动画启动的
//    同任务里 pre-pin VEIL，之间无绘制间隙），再随入场全程褪去（VEIL→透明）——「白纱褪去、
//    玻璃浮现」，与淡出对称（用户要求：入场渐显那会儿要在入场前加上半透明白）。
//    白纱写在容器（.posts-search-float）上而非胶囊上：
//    胶囊有 :focus-within 的 background 过渡，逐帧内联写入会与之打架。
//    点击触发的退场若切页未提交（swup 忽略，如纯哈希链接），FLOAT_RESTORE_MS 后恢复；
//    swup 导航**在途**时不恢复（dev 首次 fetch 可超 1.2s，提前恢复 = 搜索框中途弹回，
//    内容落地又得二次退场）——在途/失败由 window.swup 钩子判定（astro.config.ts
//    globalInstance: true）。
// d) 快速连切保护：① 上次转场未播完又切页时，旧条带/旧目录/旧内容根可能带着被 cancel 的
//    动画残留内联 transform/opacity（cancel 不清内联样式），克隆前必须清零再量盒；
//    ② 上一轮的克隆/舞台清理必须**查 DOM** 而不是读模块变量——finished 回调在动画结束才跑，
//    变量可能已为 null，读变量清理是 no-op，旧标题克隆会残留到 5s 兜底（用户看到的
//    「快速切换时旧残留，过一会儿才消失」）。
// e) 搜索框行级常驻：永不被 swup 重建（节点不被摘出/重插，backdrop 层与投影不重建，
//    切页零闪）。CSS 不写 opacity 过渡（与 motion 关键帧抢写同一属性），只负责
//    visibility/pointer-events 随行变体类瞬时翻转；opacity/位移/白纱全由本文件驱动。
//
// category-tree 脚本守卫：从非文章页 swup 进文章区时，壳里脚本不在首屏 HTML，
// 这里按需懒加载（模块单例，加载后自身的 document 委托与 after-swap 监听长期存活）。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  // ================= 0. 常量与环境 =================

  const EDGE_MS = 400; // 左缘滑动 / 内容滑动 / 普通渐隐时长（用户要求 220→300→400ms 逐步放慢）
  const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]; // 平滑进出
  // 桌面端搜索/目录配对相位：退出短促（加速离场），进入稍长（减速落位）
  const EXIT_MS = 240;
  const ENTRY_MS = 320;
  const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];
  const EASE_ENTRY: [number, number, number, number] = [0, 0, 0.2, 1];
  const SEARCH_DX = 48; // 搜索「移一段」的位移距离
  const TOC_OFFSCREEN_PAD = 40; // 目录移出屏幕的额外余量（整体在视口右缘之外）
  // 目录的渐显/渐隐与位移解耦（用户要求：入场渐显延迟一点、出场渐隐更快——位移节奏
  // 参照电脑端搜索框的移动切换：进入 ENTRY_MS/EASE_ENTRY、退出 EXIT_MS/EASE_EXIT）：
  const TOC_ENTRY_FADE_DELAY = 80; // 目录入场渐显延迟（ms）：位移先起步、渐显后到，与位移同时收尾
  const TOC_EXIT_FADE_MS = 140; // 目录出场渐隐时长（ms）：快于位移（EXIT_MS），先淡净、位移再带走
  // 手机端（≤768px）：新内容滑动距离 / 搜索框小位移 / 搜索位移与渐隐时长
  // （渐隐比位移快：上移时避免半透明胶囊蹭到上方标题）
  const MOBILE_SLIDE = 48;
  const FLOAT_MOVE = 20;
  const FLOAT_EXIT_MS = 300;
  const FLOAT_EXIT_FADE_MS = 180;
  const FLOAT_ENTRY_FADE_MS = 220;
  // 手机端「关文章」：搜索自上方落回的延迟（用户反馈：下移时叠在文章卡片上）。
  // 整页自上方 48px 推下时，文章卡顶（172.6-48=124.6）起初在搜索框钉住位底边（138.6）
  // 之下；搜索框落回（20px）若与推下同帧起步，半透明胶囊会压在卡顶约 14px。推迟到
  // 卡片顶已下移越过胶囊底边（≈135ms）再落回，可见帧全程无叠压；150+300=450ms，
  // 比 400ms 推入仅晚 50ms 收尾
  const FLOAT_ENTRY_DELAY_MS = 150;
  // 条带交换「模糊变过去」（**全部**左缘条带切换——桌面端所有 + 手机端列表↔文章 + 手机端
  // 列表↔分类/标签；用户指定电脑端也用模糊，滑动形态整体退役）：
  // 旧带原地模糊渐隐（blur 0→4px + opacity 1→0）、新带原地模糊渐显（blur 4px→0 + opacity 0→1）
  const STRIP_BLUR_OUT_MS = 160; // 旧条带：模糊渐隐
  const STRIP_BLUR_IN_MS = 260; // 新条带：模糊渐显
  const STRIP_BLUR_PX = 4; // 模糊峰值（px）
  // 点击触发的搜索退场：若 1.2s 内切页未提交（swup 忽略 / 目标失效），恢复搜索框
  const FLOAT_RESTORE_MS = 1200;

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  // 目录滑动只在电脑端显示目录（≥851px；更窄目录是按钮+抽屉，只走普通渐隐）
  const tocSlideGate = () => !REDUCE_MOTION && window.matchMedia('(min-width: 851px)').matches;
  const BG0 = 'rgba(255, 255, 255, 0)'; // 白纱关键帧的透明端（与 .glass 的 transparent 等价）
  const VEIL = (() => {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue('--glass-veil').trim() || 'rgba(255, 255, 255, 0.3)';
    } catch {
      return 'rgba(255, 255, 255, 0.3)';
    }
  })(); // 白纱令牌（variables.css --glass-veil）：移动渐隐的毛玻璃用它替代模糊

  function row(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.page-main');
  }

  // ================= 1. 动画登记（两套生命周期） =================
  // anims：转场动画——快速二次导航（captureOld）一律 cancel；
  // floatAnims：搜索浮层动画——独立生命周期（点击即退场可能在 before-swap 之前就开始，
  // 不能被转场中断连带杀掉；只在浮层自己的 settle/新动画前清理）
  let anims: AnimationPlaybackControls[] = [];
  let floatAnims: AnimationPlaybackControls[] = [];
  const track = (a: AnimationPlaybackControls) => {
    anims.push(a);
    return a;
  };
  const trackFloat = (a: AnimationPlaybackControls) => {
    floatAnims.push(a);
    return a;
  };
  const stopAnims = () => {
    for (const a of anims) a.cancel();
    anims = [];
  };
  const stopFloatAnims = () => {
    for (const a of floatAnims) a.cancel();
    floatAnims = [];
  };

  // ================= 2. 行变体 / 侧栏偏移 / 搜索叠放 / 侧栏高亮 =================

  /** ① 行变体：按内容标记推导（与 swup-widgets.ts 的页面类型探测同一口径） */
  function syncVariant(): void {
    const r = row();
    if (!r) return;
    const main = r.querySelector<HTMLElement>('main#swup');
    const isPost = !!main?.querySelector('.post-content');
    const isListing = !!main?.querySelector('.posts-page');
    r.classList.toggle('page-main--post', isPost);
    r.classList.toggle('page-main--listing', isListing);
    r.classList.toggle('page-main--plain', !isPost && !isListing);
  }

  /** ② 侧栏顶偏移：锚（页头 / 面包屑条）高度 + 行上的 --posts-offset-gap */
  let resizeObserver: ResizeObserver | null = null;

  function syncOffset(): void {
    const r = row();
    if (!r) return;
    const anchor = r.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) {
      r.style.removeProperty('--posts-side-offset');
      return;
    }
    const gap = parseFloat(getComputedStyle(r).getPropertyValue('--posts-offset-gap')) || 0;
    r.style.setProperty('--posts-side-offset', `${Math.round(anchor.offsetHeight + gap)}px`);
  }

  /** ④ 行级常驻搜索框的叠放位置：实测页头占位符（.posts-header-search）的行内坐标，
   *  写 .posts-search-float 的内联 top/left/width——占位随标题换行/窗口变，跟着重测。
   *  占位不存在（文章页/普通页）时不动：浮动搜索已被行变体类隐藏。
   *  必须用与 transform 无关的布局坐标：锚的 ResizeObserver 首次回调可能赶在推入/反推动画
   *  途中，getBoundingClientRect 含动画位移，按它量会把错值写进内联且不再被重测
   *  （transform 不改变锚的尺寸）——所以量完要减去 slotAncestorTy（含槽自身反推）还原 */
  /** 槽**自身 + 槽到行之间祖先**的 transform y 位移和：手机端整页推拉移动的是槽的祖先（内容根），
   *  条带模糊变过去里槽自身还会做等距反推（counter）——getBoundingClientRect 含这些位移，
   *  量之前全部减去还原布局坐标，转场途中任意时刻量都是对的；静止时和恒 0（桌面端无副作用） */
  function slotAncestorTy(slot: HTMLElement, r: HTMLElement): number {
    let sum = 0;
    let e: HTMLElement | null = slot;
    while (e && e !== r && e !== document.body) {
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none') {
        const m = /matrix\(([^)]+)\)/.exec(t);
        if (m) sum += parseFloat(m[1].split(',')[5]);
      }
      e = e.parentElement;
    }
    return sum;
  }

  function syncSearchPos(): void {
    const r = row();
    const floatEl = r?.querySelector<HTMLElement>('.posts-search-float');
    const ph = r?.querySelector<HTMLElement>('.posts-header-search');
    if (!r || !floatEl || !ph) return;
    const b = r.getBoundingClientRect();
    const slot = ph.closest<HTMLElement>('.posts-edge-slot');
    if (slot) {
      const s = slot.getBoundingClientRect();
      const ty = slotAncestorTy(slot, r);
      floatEl.style.top = `${s.top - b.top - ty + ph.offsetTop}px`;
      floatEl.style.left = `${s.left - b.left + ph.offsetLeft}px`;
    } else {
      const a = ph.getBoundingClientRect();
      floatEl.style.top = `${a.top - b.top}px`;
      floatEl.style.left = `${a.left - b.left}px`;
    }
    floatEl.style.width = `${ph.offsetWidth}px`;
  }

  /** 锚是每页元素，切页后重新观察（标题换行 / 窗口缩放都会改它的高度，占位位置跟着变） */
  function observeAnchor(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const anchor = row()?.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) return;
    resizeObserver = new ResizeObserver(() => {
      syncOffset();
      syncSearchPos();
    });
    resizeObserver.observe(anchor);
  }

  /** 断点跨界（768 / 1151）一次样式重算就翻转布局结构（页头行↔列、行 padding 82↔69、
   *  槽负边距全宽化），而 ResizeObserver 在布局**之后**才回调——中间存在占位已换位、
   *  浮层内联值还没重量的帧（断点跨界时搜索框「跳一下/宽度旧值闪一下」）。
   *  MQL 的 change 回调在样式重算翻转的那一刻同步触发，此时重测与布局翻转同帧写入，
   *  消灭错位帧；RO 继续负责跨界后的连续缩放（标题换行 / 宽度变化） */
  for (const mq of [window.matchMedia('(max-width: 768px)'), window.matchMedia('(min-width: 1151px)')]) {
    mq.addEventListener('change', () => {
      syncOffset();
      syncSearchPos();
    });
  }

  /** ③ 侧栏高亮态：当前分类（最长前缀命中 data-category）+ 当前标签 */
  function syncActive(): void {
    const sidebar = row()?.querySelector<HTMLElement>('.global-sidebar');
    if (!sidebar) return;

    const segments = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const rp = segments.indexOf('posts');
    const rest = rp >= 0 ? segments.slice(rp + 1) : [];

    const items = Array.from(sidebar.querySelectorAll<HTMLElement>('.cat-item[data-category]'));
    const paths = new Set(items.map((el) => el.dataset.category));
    let activeCategory = '';
    for (let i = rest.length; i > 0; i--) {
      const candidate = decodeURIComponent(rest.slice(0, i).join('/'));
      if (paths.has(candidate)) {
        activeCategory = candidate;
        break;
      }
    }

    for (const el of items) {
      if (el.dataset.category !== activeCategory) {
        el.classList.remove('cat-item--active');
        continue;
      }
      el.classList.add('cat-item--active');
      // 只补展开、不收起：当前分类的整条路径恒可见，用户手动开的其他节点保留
      let node = el.closest<HTMLElement>('.cat-node');
      while (node) {
        if (!node.classList.contains('cat-node--open')) {
          node.classList.add('cat-node--open');
          node
            .querySelector<HTMLElement>(':scope > .cat-row > .cat-toggle')
            ?.setAttribute('aria-expanded', 'true');
        }
        node = node.parentElement?.closest<HTMLElement>('.cat-node') ?? null;
      }
    }

    // 标签页 /posts/tag/<tag>/：chip 只渲染真实标签，按文本匹配即可。
    // 必须"每次"都跑 toggle（含 activeTag 为空）：否则从标签页切走时旧 chip 的
    // chip--active 不会被摘掉，高亮残留到其他界面
    const activeTag = rest[0] === 'tag' && rest.length === 2 ? decodeURIComponent(rest[1]) : '';
    for (const chip of sidebar.querySelectorAll<HTMLElement>('.chip')) {
      chip.classList.toggle('chip--active', chip.textContent?.trim() === activeTag);
    }
  }

  // ================= 3. 克隆 =================

  /** 把元素的视觉副本贴进容器内（过场用：不参与测量、不可交互、不进可访问性树）。
   *  container = 行（左缘条克隆与目录克隆都直接挂行内，绝对定位按实测 top/left 摆位）。
   *  克隆是纯静态展示（左缘条与目录里没有 island）。
   *  清除时机：正常转场由 finished 回调移除；快速二次导航由 captureOld 查 DOM 清掉；
   *  5s 兜底只覆盖「visit 被中断、after-swap 永不来」的孤儿 */
  function cloneIntoRow(src: HTMLElement, container: HTMLElement, markerClass?: string): HTMLElement | null {
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    if (markerClass) clone.classList.add(markerClass);
    // 克隆按实测 top/left/width 绝对定位，必须把类继承的 margin 清零：
    // .posts-header / .posts-breadcrumb 宽屏带负 margin-left 压过侧栏区（流内布局手段），
    // 对绝对定位元素这个 margin 仍会生效（left+width+margin-left 过约束时 margin-left 被保留），
    // 不清零整条克隆向左偏 284px，转场时标题「跑到左侧最前面」
    clone.style.margin = '0';
    const a = src.getBoundingClientRect();
    const b = container.getBoundingClientRect();
    clone.style.position = 'absolute';
    clone.style.top = `${a.top - b.top}px`;
    clone.style.left = `${a.left - b.left}px`;
    clone.style.width = `${a.width}px`;
    clone.style.zIndex = '20';
    clone.style.pointerEvents = 'none';
    clone.setAttribute('aria-hidden', 'true');
    container.appendChild(clone);
    // 兜底：孤儿克隆 5s 后移除（visit 被中断、after-swap 永不来）
    window.setTimeout(() => clone.remove(), 5000);
    return clone;
  }

  /** 查 DOM 清掉所有残留克隆（不信任模块变量——见文件头 d②） */
  function clearClones(): void {
    row()?.querySelectorAll<HTMLElement>('.posts-toc-clone').forEach((c) => c.remove());
  }

  /** 目录移出屏幕的距离：整体移到视口右缘之外 + 余量（按元素左缘实测） */
  function tocOffscreenDx(el: HTMLElement): number {
    return Math.max(120, Math.ceil(window.innerWidth - el.getBoundingClientRect().left + TOC_OFFSCREEN_PAD));
  }

  /** 目录入场动作的构造（相位开始前先钉在屏外/透明，同任务内无绘制间隙、不闪）：
   *  电脑端自屏幕右缘左移渐显——位移 320ms 与搜索框移动切换同节奏（ENTRY_MS/EASE_ENTRY），
   *  渐显延迟 80ms 才起（用户要求入场渐显延迟一点）、与位移同时收尾；其他只渐显（400ms）。
   *  用于「旧界面没有目录、新界面出现」的进入相位（列表→文章，退出相位由搜索承担；
   *  有旧目录克隆的切页走退场相位或并行交叉渐隐，不经这里） */
  function makeTocEntry(newToc: HTMLElement): () => void {
    if (tocSlideGate()) {
      const dx = tocOffscreenDx(newToc);
      newToc.style.transform = `translateX(${dx}px)`;
      newToc.style.opacity = '0';
      return () => {
        const move = track(animate(newToc, { x: [`${dx}px`, 0] }, { duration: ENTRY_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION }));
        const fade = track(animate(newToc, { opacity: [0, 1] }, { duration: (ENTRY_MS - TOC_ENTRY_FADE_DELAY) / 1000, delay: TOC_ENTRY_FADE_DELAY / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION }));
        const cleanup = () => {
          newToc.style.transform = '';
          newToc.style.opacity = '';
        };
        move.finished.then(cleanup).catch(() => {});
        fade.finished.then(cleanup).catch(() => {});
      };
    }
    return () => {
      track(animate(newToc, { opacity: [0, 1] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
    };
  }

  // ================= 4. 搜索浮层控制（行级常驻单节点） =================
  // CSS 只管 visibility/pointer-events（随变体类瞬时翻转）+ 端点 opacity: 0；
  // opacity / 位移 / 白纱全在这里。白纱规则：**淡出与淡入都用**（容器背景 透明 ↔ VEIL）——
  // 移动渐隐的毛玻璃用实体白替代消失的模糊；淡入：入场前先加上半透明白（同任务 pre-pin、无绘制间隙），再随入场全程褪去，见文件头 c
   //（白纱/淡变只用于区内动画；跨区边界直接 settle，无动画、无白纱，见文件头 c 末）
  const floatCtl = {
    state: 'shown' as 'shown' | 'hidden' | 'exiting' | 'entering',
    active: null as AnimationPlaybackControls | null,
    restoreTimer: 0 as number,

    el(): HTMLElement | null {
      return row()?.querySelector<HTMLElement>('.posts-search-float') ?? null;
    },

    /** 钉到静态目标态：清掉一切内联（transform/opacity/visibility/背景白纱） */
    settle(show: boolean): void {
      window.clearTimeout(this.restoreTimer);
      stopFloatAnims();
      this.active = null;
      this.state = show ? 'shown' : 'hidden';
      const f = this.el();
      if (!f) return;
      f.style.transform = '';
      f.style.visibility = '';
      f.style.backgroundColor = '';
      f.style.opacity = show ? '1' : '0';
    },

    /** 切页已提交（before-swap 到来）：撤销点击退场的恢复定时器 */
    commit(): void {
      window.clearTimeout(this.restoreTimer);
    },

    /** 幂等收尾：位移与渐隐两个动画各在自己的 finished 跑一次——谁后结束谁负责
     *  清内联（motion 会把关键帧端点提交成内联样式，只清一次会被后完成的动画重新写回） */
    finish(show: boolean, f: HTMLElement): void {
      this.state = show ? 'shown' : 'hidden';
      this.active = null;
      f.style.visibility = '';
      f.style.transform = '';
      f.style.backgroundColor = '';
      f.style.opacity = show ? '1' : '0';
    },

    /** 手机端「开文章」退场：上移 + 渐隐（渐隐比位移快）+ 白纱。点击即触发（见 onDocClick） */
    exitMobile(): AnimationPlaybackControls | null {
      if (this.state !== 'shown') return this.active;
      const f = this.el();
      if (!f) return null;
      this.settle(true); // 清掉任何残留内联（幂等起点）
      this.state = 'exiting';
      f.style.visibility = 'visible'; // 变体类可能已隐藏容器（swap 先于动画结束）——退出窗口内强制可见
      const move = trackFloat(
        animate(f, { y: [0, `-${FLOAT_MOVE}px`] }, { duration: FLOAT_EXIT_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION }),
      );
      const fade = trackFloat(
        animate(f, { opacity: [1, 0], backgroundColor: [BG0, VEIL] }, { duration: FLOAT_EXIT_FADE_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION }),
      );
      this.active = move;
      move.finished.then(() => this.finish(false, f)).catch(() => {});
      fade.finished.then(() => this.finish(false, f)).catch(() => {});
      return move;
    },

    /** 桌面端退场：右移 48px（配对目录入场时）+ 渐隐 + 白纱；无配对只渐隐 */
    exitDesktop(withX: boolean): AnimationPlaybackControls | null {
      if (this.state !== 'shown') return this.active;
      const f = this.el();
      if (!f) return null;
      this.settle(true); // 清掉任何残留内联（幂等起点）
      this.state = 'exiting';
      f.style.visibility = 'visible'; // 变体类已先隐藏容器——退出窗口内强制可见
      const opts = { duration: EXIT_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION };
      const move = withX ? trackFloat(animate(f, { x: [0, `${SEARCH_DX}px`] }, opts)) : null;
      const fade = trackFloat(animate(f, { opacity: [1, 0], backgroundColor: [BG0, VEIL] }, opts));
      this.active = move ?? fade; // 相位链到整体退场（位移与渐隐同时长，链谁等效）
      if (move) move.finished.then(() => this.finish(false, f)).catch(() => {});
      fade.finished.then(() => this.finish(false, f)).catch(() => {});
      return move;
    },

    /** 手机端「关文章」入场：自上方偏移落回 + 渐显 + 白纱（入场前先铺白、随入场全程褪去——见文件头 c） */
    enterMobile(): void {
      const f = this.el();
      if (!f || this.state !== 'hidden') return;
      this.settle(false);
      this.state = 'entering';
      f.style.transform = `translateY(-${FLOAT_MOVE}px)`;
      f.style.opacity = '0';
      f.style.backgroundColor = VEIL; // 入场前先加上半透明白（见文件头 c），关键帧随入场全程褪去
      // 落回延迟（FLOAT_ENTRY_DELAY_MS）：等整页推下把文章卡顶移过胶囊底边再下移，
      // 可见帧不叠卡片（钉住位 opacity 0，延迟期不可见）
      const delay = FLOAT_ENTRY_DELAY_MS / 1000;
      const move = trackFloat(
        animate(f, { y: [`-${FLOAT_MOVE}px`, 0] }, { duration: FLOAT_EXIT_MS / 1000, delay, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION }),
      );
      const fade = trackFloat(
        animate(f, { opacity: [0, 1], backgroundColor: [VEIL, BG0] }, { duration: FLOAT_ENTRY_FADE_MS / 1000, delay, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION }),
      );
      this.active = move;
      move.finished.then(() => this.finish(true, f)).catch(() => {});
      fade.finished.then(() => this.finish(true, f)).catch(() => {});
    },

    /** 桌面端入场：自右偏移 48px 落回（配对目录退场时）+ 渐显 + 白纱（入场前先铺白、随入场全程褪去——见文件头 c）；无配对只渐显 */
    enterDesktop(withX: boolean): void {
      const f = this.el();
      if (!f || this.state !== 'hidden') return;
      this.settle(false); // 清掉任何残留内联（幂等起点）
      this.state = 'entering';
      const opts = { duration: ENTRY_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION };
      // 相位开始前先钉住（同任务内无绘制间隙，不闪）
      if (withX) f.style.transform = `translateX(${SEARCH_DX}px)`;
      f.style.opacity = '0';
      f.style.backgroundColor = VEIL; // 入场前先加上半透明白（见文件头 c），关键帧随入场全程褪去
      const move = withX ? trackFloat(animate(f, { x: [`${SEARCH_DX}px`, 0] }, opts)) : null;
      const fade = trackFloat(animate(f, { opacity: [0, 1], backgroundColor: [VEIL, BG0] }, opts));
      this.active = move ?? fade;
      if (move) move.finished.then(() => this.finish(true, f)).catch(() => {});
      fade.finished.then(() => this.finish(true, f)).catch(() => {});
    },

  };

  // ================= 5. 转场编排 =================
  let edgeClone: HTMLElement | null = null;
  let tocClone: HTMLElement | null = null;
  let oldHadSearch = false; // 旧页是列表系界面（搜索正在显示）——captureOld 时记录
  let oldIsPost = false; // 旧页是文章详情（面包屑条）——区分「区内」与「跨区」搜索处理

  /** 替换前调用（astro:before-swap，content:replace 前一刻）：清场 + 克隆静止暂存 */
  function captureOld(): void {
    stopAnims(); // 只停转场动画；搜索浮层的点击退场独立生命周期，不连带
    clearClones();
    edgeClone = null;
    tocClone = null;
    oldIsPost = false;
    floatCtl.commit(); // 切页已提交：撤销点击退场的恢复定时器
    const r = row();
    if (!r) return;
    const main = r.querySelector<HTMLElement>('main#swup');
    // 快速连切保护：上次转场未播完时，旧内容根 / 旧条带 / 旧目录可能带着被 cancel 的
    // 动画残留内联 transform/opacity（cancel 不清内联样式）——克隆的量盒必须按
    // 自然位置来，先清零。这些元素马上就要被 swup 换掉，清零的这一帧不会被看见
    main?.querySelector<HTMLElement>('.posts-article, .posts-page')?.style.removeProperty('transform');
    const old = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb');
    if (old) {
      old.style.transform = '';
      old.style.opacity = '';
      oldHadSearch = !!old.querySelector('.posts-header-search');
      oldIsPost = old.classList.contains('posts-breadcrumb');
      edgeClone = cloneIntoRow(old, r);
    }
    const oldToc = main?.querySelector<HTMLElement>('.post-sidebar');
    if (oldToc && getComputedStyle(oldToc).display !== 'none') {
      oldToc.style.transform = '';
      oldToc.style.opacity = '';
      tocClone = cloneIntoRow(oldToc, r, 'posts-toc-clone');
    }
  }

  /** 新内容加载完后调用（astro:after-swap）：判定界面并播放转场 */
  function playTransition(): void {
    const r = row();
    // 新元素只在 main#swup 里找：克隆挂进行内（#swup 之外），若在整行里 querySelector，
    // 离开文章区时唯一命中的会是克隆自己（两个动画加到同一节点互相覆盖）
    const main = r?.querySelector<HTMLElement>('main#swup');
    const newEdge = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb') ?? null;
    const newTocEl = main?.querySelector<HTMLElement>('.post-sidebar') ?? null;
    const hasNewToc = !!newTocEl && getComputedStyle(newTocEl).display !== 'none'; // ≤850px 目录 display:none，不参与
    const newHadSearch = !!newEdge?.querySelector('.posts-header-search');
    const newIsPost = !!main?.querySelector<HTMLElement>('.post-content'); // 新页是文章详情（区分区内/跨区）
    const opening = oldHadSearch && !newHadSearch; // 列表→文章
    const closing = !oldHadSearch && newHadSearch; // 文章→列表
    // 手机端（≤768px）列表↔文章：固定方向整页推拉（开=上 / 关=下）
    const mobilePush = isMobile() && !REDUCE_MOTION && (opening || closing);

    // ---- 搜索/目录相位：退出相位走完才播进入相位（先退场再入场）----
    let exitAction: (() => AnimationPlaybackControls | null) | null = null;
    let entryAction: (() => void) | null = null;

    if (mobilePush) {
      // 手机端（≤768px）列表↔文章：搜索走独立的上下位移（开=点击已触发的退场；关=自上方落回渐显）；
      // 目录在 ≤768px 不存在（按钮+抽屉），不参与。
      // 跨区（列表↔普通页）不做搜索淡变：无退场/入场动作，搜索随 after-swap settle 直接消失/出现（用户指定）
      if (opening && newIsPost) {
        // 区内「开文章」：退场通常已在点击时启动；没启动（非点击导航）就补启动
        exitAction = () => (floatCtl.state === 'exiting' ? floatCtl.active : floatCtl.state === 'shown' ? floatCtl.exitMobile() : null);
      } else if (closing && oldIsPost) {
        // 区内「关文章」：自上方落回渐显
        entryAction = () => floatCtl.enterMobile();
      }
    } else if (tocClone) {
      const crossfade = hasNewToc; // 文章↔文章：两侧都有目录 → 并行交叉渐隐（不参与相位，见下）
      if (!crossfade) {
        // 目录退场：电脑端右移移出屏渐隐——位移 240ms 与搜索框移动切换同节奏
        // （EXIT_MS/EASE_EXIT），渐隐 140ms 快于位移（用户要求出场渐隐更快）；其他只渐隐
        exitAction = () => {
          const el = tocClone as HTMLElement;
          const slide = tocSlideGate();
          const dx = slide ? tocOffscreenDx(el) : 0;
          const move = slide
            ? track(animate(el, { x: [0, `${dx}px`] }, { duration: EXIT_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION }))
            : null;
          const fade = track(animate(el, { opacity: [1, 0] }, { duration: (slide ? TOC_EXIT_FADE_MS : EDGE_MS) / 1000, ease: slide ? EASE_EXIT : EASE, reduceMotion: REDUCE_MOTION }));
          const last = move ?? fade; // 相位链等位移走完（位移比渐隐长）；无位移时等渐隐
          last.finished
            .then(() => {
              el.remove();
              tocClone = null;
            })
            .catch(() => {});
          return last;
        };
      }
    } else if (hasNewToc) {
      // 新界面有目录、旧界面没有（列表→文章）：只有进入相位——退出相位由搜索承担（见下）
      entryAction = makeTocEntry(newTocEl as HTMLElement);
    }
    // 搜索退场/入场：只在文章区内（列表↔详情）配对播放；
    // 跨区（列表↔普通页）不设动作——走下方 settle 直接消失/出现（用户指定：切到其他界面不渐隐、切到文章界面不渐显）
    if (!mobilePush) {
      if (oldHadSearch && !newHadSearch && floatCtl.state === 'shown' && newIsPost) {
        const withX = tocSlideGate() && hasNewToc; // 与新目录入场配对时才右移
        exitAction = () => floatCtl.exitDesktop(withX);
      } else if (newHadSearch && !oldHadSearch && floatCtl.state === 'hidden' && oldIsPost) {
        const withX = tocSlideGate() && !!tocClone; // 与旧目录退场配对时才自右移入
        entryAction = () => floatCtl.enterDesktop(withX);
      }
    }

    // ---- 相位调度：退出相位走完才播进入相位（cancel = 快速二次导航，进入不启动）----
    if (exitAction) {
      const a = exitAction();
      if (a) a.finished.then(() => entryAction?.()).catch(() => {});
      else entryAction?.(); // 已在终态（如手机端点击退场已播完）→ 直接进入相位
    } else {
      entryAction?.();
    }
    // 本轮无搜索退场/入场（列表↔列表互切、首屏、**跨区边界**——区内才做淡变）：钉回目标态，零闪
    if (!exitAction && !entryAction) floatCtl.settle(newHadSearch);

    // ---- 左缘条带切换（列表页头 ↔ 文章面包屑条）：全部走「模糊变过去」----
    // 旧带原地模糊渐隐、新带原地模糊渐显，无位移（用户指定：电脑端也用模糊；手机端
    // 列表↔分类/标签的「一张纸」滑动形态随之整体退役）。手机端列表↔文章另做整页推入的
    // 反向抵消（counter）：根自 ±MOBILE_SLIDE 推到 0 时槽走反方向同距离（同任务启动、
    // 同时长同缓动，见下方推拉块），新条带在屏幕上原地不动——读起来是「标题模糊成
    // 面包屑」，不是「面包屑浮上来」
    if (edgeClone && newEdge) {
      const exitEl = edgeClone;
      const out = track(animate(exitEl, { opacity: [1, 0], filter: ['blur(0px)', `blur(${STRIP_BLUR_PX}px)`] }, { duration: STRIP_BLUR_OUT_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION }));
      out.finished
        .then(() => {
          exitEl.remove();
          edgeClone = null;
        })
        .catch(() => {});
      if (mobilePush) {
        const newSlot = newEdge.parentElement;
        if (newSlot) {
          const y0 = opening ? -MOBILE_SLIDE : MOBILE_SLIDE;
          const cnt = track(animate(newSlot, { y: [`${y0}px`, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
          cnt.finished
            .then(() => {
              newSlot.style.transform = '';
            })
            .catch(() => {});
        }
      }
      const inn = track(animate(newEdge, { opacity: [0, 1], filter: [`blur(${STRIP_BLUR_PX}px)`, 'blur(0px)'] }, { duration: STRIP_BLUR_IN_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION }));
      inn.finished
        .then(() => {
          newEdge.style.filter = ''; // 终态 = 无模糊，清内联
        })
        .catch(() => {});
    } else if (edgeClone) {
      edgeClone.remove(); // 新界面是普通屏：不播，直接随替换消失
      edgeClone = null;
    }

    // ---- 手机端整页推拉：新内容自下方/上方滑入（开=上滑入 / 关=下滑入）----
    if (mobilePush) {
      const root = opening ? (main?.querySelector<HTMLElement>('.posts-article') ?? null) : (main?.querySelector<HTMLElement>('.posts-page') ?? null);
      if (root) {
        const y0 = opening ? MOBILE_SLIDE : -MOBILE_SLIDE;
        const a = track(animate(root, { y: [`${y0}px`, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
        a.finished
          .then(() => {
            root.style.transform = '';
          })
          .catch(() => {});
      }
    }

    // ---- 目录交叉渐隐（文章↔文章，两侧都有目录）：并行、无位移、不参与相位 ----
    if (tocClone && hasNewToc) {
      const fadeEl = tocClone;
      const fade = track(animate(fadeEl, { opacity: [1, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
      fade.finished
        .then(() => {
          fadeEl.remove();
          tocClone = null;
        })
        .catch(() => {});
      track(animate(newTocEl as HTMLElement, { opacity: [0, 1] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
    }
  }

  // ================= 6. 事件与初始化 =================

  // swup 实例钩子：区分「真实导航在途」与「swup 忽略了这次点击」。
  // @swup/astro 只在 document 上桥接 astro:before-swap / after-swap / page-load 三个事件，
  // 覆盖不了这两个状态，所以用 astro.config.ts globalInstance: true 暴露的 window.swup
  //（swup 在 onIdleAfterLoad 才初始化，实例可能晚于本模块——钩子按需在首次点击时绑）。
  // 用途：点击触发的搜索退场后，恢复定时器在「导航在途」时不得触发——dev 首次 fetch
  // 可超 1.2s，提前恢复 = 搜索框在切换中途弹回、内容落地又得二次退场（用户看到的
  // 「初次切到文章搜索框渐显」）；fetch 失败（404 / 中断）时在失败回调里恢复。
  let navInFlight = false;
  let swupHooksBound = false;
  function bindSwupHooks(): void {
    if (swupHooksBound) return;
    const swup = (window as Window & { swup?: { hooks: { on: (name: string, handler: () => void) => void } } }).swup;
    if (!swup) return;
    swupHooksBound = true;
    swup.hooks.on('visit:start', () => {
      navInFlight = true;
    });
    swup.hooks.on('content:replace', () => {
      navInFlight = false;
    });
    const restoreAfterFail = () => {
      navInFlight = false;
      // 只在「仍停在列表系界面」时恢复——失败后内容未换，若此刻在详情页，
      // 搜索不该出现（旧版无条件 settle(true) 会在详情页把搜索弹出来）
      if (floatCtl.state !== 'shown' && row()?.classList.contains('page-main--listing')) floatCtl.settle(true);
    };
    swup.hooks.on('fetch:error', restoreAfterFail);
    swup.hooks.on('visit:abort', restoreAfterFail);
  }

  /** 手机端列表页出发：/posts/ 内导航点击即退场（用户要求——不等内容加载）；
   *  跨区（→ 普通页）点击即直接消失（不渐隐，用户指定）。
   *  委托 click 监听（只观察、不拦截，swup 自己的点击处理不受影响）；
   *  切页未提交（swup 忽略，如纯哈希链接）FLOAT_RESTORE_MS 后恢复；导航在途则不恢复 */
  function onDocClick(e: MouseEvent): void {
    if (REDUCE_MOTION || !isMobile()) return;
    bindSwupHooks();
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest('a[href]');
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('/') || a.target === '_blank') return;
    if (a.hasAttribute('data-no-swup') || t.closest('[data-no-swup]')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (floatCtl.state !== 'shown') return; // 只处理「搜索正在显示」（列表系）出发的导航
    if (!row()?.classList.contains('page-main--listing')) return;
    if (href.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '')) return; // 同页
    window.clearTimeout(floatCtl.restoreTimer);
    if (href.startsWith('/posts')) {
      // 区内（→ 详情/其他列表）：点击即退场（上移 + 渐隐 + 白纱，不等内容加载）
      floatCtl.exitMobile();
    } else {
      // 跨区（→ 普通页）：直接消失，不渐隐（用户指定）
      floatCtl.settle(false);
    }
    floatCtl.restoreTimer = window.setTimeout(() => {
      // 只在「切页确实没发生」时恢复：导航在途（visit:start 已报、content:replace 未到）
      // 时不动——dev 首次 fetch 常超 1.2s，提前恢复 = 搜索框中途弹回；
      // 导航真没发生（swup 忽略 / fetch 失败未回调）就钉回——退场可能早已播完
      //（state 已是 'hidden'），只查 'exiting' 会让搜索框永远消失
      if (floatCtl.state !== 'shown' && !navInFlight && row()?.classList.contains('page-main--listing')) floatCtl.settle(true);
    }, FLOAT_RESTORE_MS);
  }

  // ---- category-tree 脚本守卫：侧栏常驻，模块只需加载一次 ----
  let importing = false;
  function ensureCategoryTree(): void {
    if (window.__postCatTreeBound || importing) return;
    const r = row();
    // 普通页侧栏隐藏、树不需要交互，不加载（省 motion 共享块）
    if (!r || r.classList.contains('page-main--plain')) return;
    if (!document.getElementById('category-tree')) return;
    importing = true;
    import('./category-tree').finally(() => {
      importing = false;
    });
  }

  function onReady(isSwap = false): void {
    syncVariant();
    syncOffset();
    observeAnchor();
    syncSearchPos();
    syncActive();
    ensureCategoryTree();
    if (isSwap) {
      // 首屏整页加载不播转场，只有 swup 切页才播；此刻新内容已加载完，播放不会先于内容
      playTransition();
    } else {
      // 首屏：搜索钉到变体目标态（在首次绘制前，无闪）
      const r = row();
      if (r) floatCtl.settle(r.classList.contains('page-main--listing'));
    }
  }

  // astro:* 事件由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('click', onDocClick);
  document.addEventListener('astro:before-swap', captureOld);
  document.addEventListener('astro:after-swap', () => onReady(true));
  onReady();
})();

// 标记为模块：文件顶层有 import，TS 模块检查要求显式模块语义
export {};
