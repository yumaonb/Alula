// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts-shell"
//
// 侧边栏（GlobalSidebar）在 #swup 之外、切页不重建，所以每次切页后三件事要自己跟上：
// ① 行的变体类（--plain/--listing/--post，驱动侧栏显隐与内容列 1000px 收窄）；
// ② 侧栏顶偏移 --posts-side-offset（实测"页锚高度 + 间隙"，页锚 = 页头 / 面包屑条，
//    带 data-posts-anchor 标记）；
// ③ 侧栏高亮态（当前分类高亮 + 其路径补展开、当前标签高亮）。
// 只"补展开"不收起：用户手动开合的节点在切页后保留，当前分类路径恒可见。
// ④ 左缘元素（列表页头 / 文章面包屑条）切页滑动切换，motion 驱动：
//    只在文章区界面之间生效（涉及普通屏不播、不消耗流向）；swup 替换瞬间丢弃旧 DOM，
//    替换前（astro:before-swap）克隆旧元素进行内静止暂存，等新界面加载完
//    （astro:after-swap）才播放——过渡绝不先于内容。
//    流向交替：每次播放的流向与上一次相反（首次"上"）；"上" = 旧元素向上滑出、
//    新元素自下方上滑入，"下"相反。
//    "一张纸"整体感：退出侧位移 + 全时长渐隐（边滑出边淡掉，同时消掉「下」流向
//    尾段压新卡片的问题）、进入侧纯位移全程不透明（淡入会留落地前空白闪）——
//    新旧两条实心带位移上全程贴合，像同一张纸被拉开，不出现"先出后进"的割裂。
//    搜索框不参与滑动（反向位移抵消 = 原地不动；克隆副本默认 visibility:hidden 防
//    双份投影加深搜索下方阴影，仅新页无搜索框时随父带淡出，列表系互切零淡变）。
//    目录不参与滑动，进出各做一次 220ms 淡入/淡出防硬切闪。
// 另负责 category-tree 脚本守卫：从非文章页 swup 进文章区时，壳里脚本不在首屏 HTML，
// 这里按需懒加载（模块单例，加载后自身的 document 委托与 after-swap 监听长期存活）。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  const EDGE_MS = 220; // 滑动 / 目录淡入淡出时长（与 nav-indicator 的从容感区分：短促干脆）
  const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]; // 快起缓收（与导航指示线一致）
  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function row(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.page-main');
  }

  // ---- ① 行变体：按内容标记推导（与 swup-widgets.ts 的页面类型探测同一口径） ----
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

  // ---- ② 侧栏顶偏移：锚（页头 / 面包屑条）高度 + 行上的 --posts-offset-gap ----
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

  /** 锚是每页元素，切页后重新观察（标题换行 / 窗口缩放都会改它的高度） */
  function observeAnchor(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const anchor = row()?.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) return;
    resizeObserver = new ResizeObserver(() => syncOffset());
    resizeObserver.observe(anchor);
  }

  // ---- ③ 侧栏高亮态：当前分类（最长前缀命中 data-category）+ 当前标签 ----
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

  // ---- ④ 左缘元素切页滑动 + 目录淡入淡出（motion 驱动，CSS 只留端点状态） ----
  // 范围：只在新旧两个界面都在文章区（都有左缘元素）时播；涉及普通屏的切换不播。
  // 时机：替换前克隆旧元素进 #swup 外的行内**静止暂存**，等新界面加载完（after-swap）
  //       才播放——过渡绝不先于内容，也不会与加载竞速。
  // 流向：逐次交替，本次与上一次相反（首次"上"）；普通屏切换不消耗。
  //   "上"：旧元素 0→-100% 淡出，新元素 +100%→0 滑入（自下方上移）；
  //   "下"：旧元素 0→+100% 淡出，新元素 -100%→0 滑入（自上方下移）。
  // 进入侧全程不透明：若新元素带淡入，它从 0 透明度起爬升，左缘格子在新内容落地后
  // 要先空一段（空白闪）；只位移的话元素落地前就可见、连续滑到位，无闪。
  type Flow = 'up' | 'down';
  let edgeClone: HTMLElement | null = null;
  let tocClone: HTMLElement | null = null;
  let lastFlow: Flow | null = null;
  let anims: AnimationPlaybackControls[] = [];

  /** 快速二次导航：停掉上一轮还没跑完的过渡（新元素随替换移除，克隆随 captureOld 移除） */
  function stopAnims(): void {
    for (const a of anims) a.cancel();
    anims = [];
  }

  /** 把元素的视觉副本贴进行内（过场用：不参与测量、不可交互、不进可访问性树）。
   *  清除时机：正常转场由 playTransition 在滑出动画结束（finished）时移除；
   *  快速二次导航由下一次 captureOld 先清掉；5s 兜底只覆盖"visit 被中断、
   *  after-swap 永不来"的孤儿克隆（dev 慢加载也不会误伤：动画 220ms 内必已结束） */
  function cloneIntoRow(src: HTMLElement, r: HTMLElement): HTMLElement | null {
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    // 克隆必须与 swup 的跨屏持久机制彻底绝缘（否则两处事故）：
    // 1) data-swup-persist：swup 换页前会 queryAll 收集带此属性的元素做恢复，克隆若带着它，
    //    恢复循环会把刚换回的真实搜索实例二次替换成克隆的静态副本（搜索直接失效）
    clone.querySelectorAll('[data-swup-persist]').forEach((el) => el.removeAttribute('data-swup-persist'));
    // 2) astro-island 是自定义元素：克隆插入 DOM 即触发 connectedCallback→start() 白跑一次水合，
    //    还挂一个永不触发的 window 监听把整棵克隆子树钉在内存里。换成 display:contents 的普通 div
    //    （astro-island 本身就是 display:contents，视觉不变），克隆保持纯静态展示
    clone.querySelectorAll('astro-island').forEach((island) => {
      const d = document.createElement('div');
      d.style.display = 'contents';
      d.innerHTML = island.innerHTML;
      island.replaceWith(d);
    });
    // 克隆按实测 top/left/width 绝对定位，必须把类继承的 margin 清零：
    // .posts-header / .posts-breadcrumb 宽屏带负 margin-left 压过侧栏区（流内布局手段），
    // 对绝对定位元素这个 margin 仍会生效（left+width+margin-left 过约束时 margin-left 被保留），
    // 不清零整条克隆向左偏 284px，转场时标题「跑到左侧最前面」
    clone.style.margin = '0';
    const a = src.getBoundingClientRect();
    const b = r.getBoundingClientRect();
    clone.style.position = 'absolute';
    clone.style.top = `${a.top - b.top}px`;
    clone.style.left = `${a.left - b.left}px`;
    clone.style.width = `${a.width}px`;
    clone.style.zIndex = '20';
    clone.style.pointerEvents = 'none';
    clone.setAttribute('aria-hidden', 'true');
    r.appendChild(clone);
    window.setTimeout(() => clone.remove(), 5000);
    return clone;
  }

  /** 替换前调用：旧左缘元素与旧目录克隆进行内静止暂存（还没播，等新界面加载完定流向） */
  function captureOld(): void {
    // 快速二次导航：先清掉上一次转场还没跑完的克隆
    stopAnims();
    edgeClone?.remove();
    tocClone?.remove();
    edgeClone = null;
    tocClone = null;
    const r = row();
    if (!r) return;
    const old = r.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb');
    // 搜索框跨屏持久（.posts-header-search 带 data-swup-persist）：swup 换页时会把同一个
    // astro-island 节点重新插回新页头，而 astro-island 的 connectedCallback 会再跑 start()
    // 对同一节点二次水合（双 Svelte 实例、事件监听翻倍）。这里把该实例的 start 一次性屏蔽成
    // 空操作——元素本身持久存活，标记只需打一次（克隆在下方制作，克隆内的 island 会被替换掉）
    const searchIsland = old?.querySelector('astro-island');
    if (searchIsland) {
      (searchIsland as unknown as { start?: unknown }).start = () => {};
    }
    if (old) {
      edgeClone = cloneIntoRow(old, r);
      // 搜索胶囊克隆默认隐藏（visibility 而非移除）：它是 .glass 胶囊（大投影 + 描边 + 磨砂）的
      // 完整副本，在 before-swap→after-swap 的取数窗口里会与真实胶囊精确重叠——双份投影把搜索
      // 下方的阴影变深，用户看到「搜索下面有啥、切页时阴影在变」；playTransition 判定新页没有
      // 搜索框时才显示它做原地淡出
      const searchCopy = edgeClone?.querySelector<HTMLElement>('.posts-header-search');
      if (searchCopy) searchCopy.style.visibility = 'hidden';
    }
    const oldToc = r.querySelector<HTMLElement>('.post-sidebar');
    if (oldToc) tocClone = cloneIntoRow(oldToc, r);
  }

  /** 新内容加载完后调用：判定范围并播放转场 */
  function playTransition(): void {
    const r = row();
    // 新元素只在 main#swup 里找：克隆挂进行内（#swup 之外），若在整行里 querySelector，
    // 离开文章区/目录页时唯一命中的会是克隆自己，导致旧元素被误当新元素（两个动画互相覆盖）
    const main = r?.querySelector<HTMLElement>('main#swup');
    const newEdge = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb') ?? null;
    const newToc = main?.querySelector<HTMLElement>('.post-sidebar') ?? null;

    if (edgeClone) {
      if (newEdge) {
        // 新旧都在文章区：播放并消耗流向（本次与上次相反；首次"上"）
        const flow: Flow = lastFlow === 'up' ? 'down' : 'up';
        lastFlow = flow;
        // 用局部引用接住克隆：edgeClone 变量本函数末尾会置 null，
        // finished 回调（220ms 后才触发）里若再读变量，拿到的就是 null，克隆永远清不掉
        const exitEl = edgeClone;
        const oldHadSearch = !!exitEl.querySelector('.posts-header-search'); // 旧页是否为列表系（有搜索框）
        const H = exitEl.offsetHeight; // 左缘带高（36px）：滑动距离 = 带高，新旧两带全程保持贴合
        const exitTo = flow === 'up' ? -H : H; // 旧元素退出方向
        // 退出侧：位移 + 渐隐同时走（用户要求「边滑动边渐隐」）：旧带边滑出边淡掉，
        // 进入侧仍纯位移全程不透明——几何上两带全程贴合（「一张纸」不破坏），退场的一半优雅溶解；
        // 全时长渐隐也顺带解决了「下」流向尾段压过新内容卡片顶的问题（尾段自己淡没了）
        const exit = animate(exitEl, { y: [0, `${exitTo}px`], opacity: [1, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION });
        anims.push(exit);
        // 滑出结束即移除克隆（cancel 时 finished 会 reject，忽略——克隆已由 captureOld 清掉）
        exit.finished.then(() => exitEl.remove()).catch(() => {});
        // 搜索框不跟滑动（用户要求）：克隆里的搜索框做反向位移抵消父级位移 = 原地不动。
        // 新页也有搜索框（列表系互切）：真实实例（data-swup-persist）已在原位，克隆副本全程保持
        // captureOld 设的 visibility:hidden——.glass 胶囊叠在真实胶囊上会把搜索下方阴影加倍变深，
        // 绝不能露出来。新页没有搜索框（文章详情）：显示出来，随父带一起淡出（父带的全时长渐隐
        // 已覆盖它，无需单独 opacity 动画），只补反向位移保持原地
        const newHasSearch = !!newEdge.querySelector('.posts-header-search');
        const oldSearch = exitEl.querySelector<HTMLElement>('.posts-header-search');
        if (oldSearch && !newHasSearch) {
          oldSearch.style.visibility = 'visible';
          anims.push(animate(oldSearch, { y: [0, `${-exitTo}px`] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
        }
        // 进入侧：全程不透明（只位移不淡入）；两条带各走自身全高，任意时刻并集覆盖左缘格子
        anims.push(animate(newEdge, { y: [`${-exitTo}px`, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
        // 新搜索框（只有新页面是列表/分类/标签页才有）：反向位移抵消 = 原地不动。
        // 搜索框跨屏持久（.posts-header-search 带 data-swup-persist，swup 切页把同一实例原样换回）：
        // 列表系界面之间实例位置本就不变，不能带淡入淡出（淡变 = 用户看到的「搜索闪一下」）；
        // 只有从没有搜索框的页面（文章详情）回来才淡入
        const newSearch = newEdge.querySelector<HTMLElement>('.posts-header-search');
        if (newSearch) {
          const searchOpts = { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION };
          if (oldHadSearch) {
            anims.push(animate(newSearch, { y: [`${exitTo}px`, 0] }, searchOpts));
          } else {
            anims.push(animate(newSearch, { y: [`${exitTo}px`, 0], opacity: [0, 1] }, searchOpts));
          }
        }
      } else {
        edgeClone.remove(); // 新界面是普通屏：不播，直接随替换消失
      }
    }
    edgeClone = null;
    // 旧页有目录就淡出（不取决于新页有没有）：离开文章页时目录右侧硬消失同样会闪
    if (tocClone) {
      const fadeEl = tocClone; // 同上：局部引用，防止回调触发时变量已置 null
      const fade = animate(fadeEl, { opacity: [1, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION });
      anims.push(fade);
      fade.finished.then(() => fadeEl.remove()).catch(() => {});
    }
    tocClone = null;
    // 新页有目录就淡入（含从普通屏切入），避免右侧硬切闪一下
    if (newToc) {
      anims.push(animate(newToc, { opacity: [0, 1] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
    }
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
    syncActive();
    ensureCategoryTree();
    // 首屏整页加载不播转场，只有 swup 切页才播；此刻新内容已加载完，播放不会先于内容
    if (isSwap) playTransition();
  }

  // 两个事件都由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('astro:before-swap', captureOld);
  document.addEventListener('astro:after-swap', () => onReady(true));
  onReady();
})();

// 标记为模块：文件顶层有 import，TS 模块检查要求显式模块语义
export {};
