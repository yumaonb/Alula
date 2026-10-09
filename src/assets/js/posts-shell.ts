// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts-shell"
//
// 侧边栏（GlobalSidebar）与搜索框（PostSearch）都在 #swup 之外、切页不重建，
// 所以每次切页后五件事要自己跟上：
// ① 行的变体类（--plain/--listing/--post，驱动侧栏/搜索显隐与内容列 1000px 收窄）；
// ② 侧栏顶偏移 --posts-side-offset（实测"页锚高度 + 间隙"，页锚 = 页头 / 面包屑条，
//    带 data-posts-anchor 标记）；
// ③ 侧栏高亮态（当前分类高亮 + 其路径补展开、当前标签高亮）；
// ④ 行级常驻搜索框的叠放位置（实测页头占位符 .posts-header-search 的行内坐标，
//    写 .posts-search-float 的内联 top/left/width——占位随标题换行/窗口变，跟着重测）；
// ⑤ 切页转场（motion 驱动，只在文章区界面之间生效；涉及普通屏不播、不消耗流向）：
//    a) 左缘元素（列表页头 / 文章面包屑条）滑动：swup 替换瞬间丢弃旧 DOM，替换前
//       （astro:before-swap）克隆旧元素进行内**静止暂存**，等新界面加载完
//       （astro:after-swap）才播放——过渡绝不先于内容。流向交替（首次"上"）。
//       "一张纸"整体感：退出侧位移 + 全时长渐隐、进入侧纯位移全程不透明（淡入会留
//       落地前空白闪）。滑动只在「口袋」里：旧带克隆裁进 .posts-edge-stage、新带槽
//       转场期 is-clip 裁切——条只在自己 36px 高度内滑动，永不压下方内容（作者卡顶 132px）。
//    b) 搜索/目录退场配对（用户要求：先退场再入场）：目录出现/消失的切页里，
//       退出相位（240ms）走完才播进入相位（320ms）——
//       列表→文章：搜索右移一小段渐隐（退场）→ 目录自屏幕右缘左移渐显（入场）；
//       文章→列表：目录右移移出屏幕渐隐（退场）→ 搜索自右侧偏移左移渐显（入场）。
//       只在电脑端显示目录（≥851px；更窄目录是按钮+抽屉，只走普通渐隐）；
//       文章↔文章两侧都有目录，保持 400ms 并行交叉渐隐、无位移。
//    c) 快速连切保护：上次转场未播完又切页时，① 旧条带/旧目录可能带着被 cancel 的
//       动画残留内联 transform/opacity（cancel 不清内联样式），克隆前必须清零再量盒；
//       ② 上一轮的克隆/舞台清理必须**查 DOM** 而不是读模块变量——finished 回调在
//       动画结束才跑，变量早已被置 null，读变量清理是 no-op，旧标题克隆会残留到
//       5s 兜底才消失（用户看到的「快速切换时旧残留，过一会儿才消失」）。
//    搜索框是行级常驻（.posts-search-float，不在条里、不被 swup 碰）：永不被重新插入
//    （旧方案 data-swup-persist 每次切页摘出再插回，.glass 胶囊的 backdrop 层每页重建
//    = 用户看到的「阴影一闪一闪」），位置与显隐见 ④ 与 b。
// 另负责 category-tree 脚本守卫：从非文章页 swup 进文章区时，壳里脚本不在首屏 HTML，
// 这里按需懒加载（模块单例，加载后自身的 document 委托与 after-swap 监听长期存活）。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  const EDGE_MS = 400; // 左缘滑动 / 普通渐隐时长（用户要求再慢一点：300ms 还不够）
  const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]; // 平滑进出（比快起缓收更"匀速丝滑"）
  // 搜索/目录退场配对：退出相位短促（先走）、进入相位稍长（落定感）；
  // 缓动各自取「加速离场 / 减速落位」，与左缘滑动的平滑进出区分
  const EXIT_MS = 240;
  const ENTRY_MS = 320;
  const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];
  const EASE_ENTRY: [number, number, number, number] = [0, 0, 0.2, 1];
  const SEARCH_DX = 48; // 搜索「移一段」的位移距离（用户要求：移一段再渐隐，不是整段移出）
  const TOC_OFFSCREEN_PAD = 40; // 目录移出屏幕的额外余量（整个视口右缘之外）
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

  /** 行级常驻搜索框的叠放位置：实测页头占位符（.posts-header-search）的行内坐标，
   *  写 .posts-search-float 的内联 top/left/width——占位随标题换行/窗口变，跟着重测。
   *  占位不存在（文章页/普通页）时不动：浮动搜索已被行变体类隐藏 */
  function syncSearchPos(): void {
    const r = row();
    const floatEl = r?.querySelector<HTMLElement>('.posts-search-float');
    const ph = r?.querySelector<HTMLElement>('.posts-header-search');
    if (!r || !floatEl || !ph) return;
    // 用不依赖 transform 的布局坐标：锚的 ResizeObserver 首次回调（observe 后立即触发）
    // 可能赶在新条带 enter 动画刚起步时——getBoundingClientRect 含动画位移（首帧 y=±36px），
    // 按 rect 量会把错误位置写进内联且不再被重测（动画不改变锚的尺寸）。槽是条的父级
    // （自身不参与动画），占位的 offsetTop/offsetLeft/offsetWidth 是布局值，不受影响
    const b = r.getBoundingClientRect();
    const slot = ph.closest<HTMLElement>('.posts-edge-slot');
    if (slot) {
      const s = slot.getBoundingClientRect();
      floatEl.style.top = `${s.top - b.top + ph.offsetTop}px`;
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

  // ---- ④⑤ 左缘滑动 + 搜索/目录退场配对（motion 驱动，CSS 只留端点状态） ----
  type Flow = 'up' | 'down';
  let edgeClone: HTMLElement | null = null;
  let edgeStage: HTMLElement | null = null; // 旧带克隆的裁切舞台（口袋），与克隆同生共死
  let tocClone: HTMLElement | null = null;
  let oldHadSearch = false; // 旧页是列表系界面（搜索正在显示）——captureOld 时记录（playTransition 时旧 DOM 已不在）
  let lastFlow: Flow | null = null;
  let anims: AnimationPlaybackControls[] = [];

  /** 快速二次导航：停掉上一轮还没跑完的所有过渡（含搜索/目录相位） */
  function stopAnims(): void {
    for (const a of anims) a.cancel();
    anims = [];
  }

  /** 清掉所有槽上的转场裁切类（兜底：动画被中断/放弃时不让 is-clip 残留） */
  function clearSlotClip(): void {
    document.querySelectorAll<HTMLElement>('.posts-edge-slot.is-clip').forEach((s) => s.classList.remove('is-clip'));
  }

  /** 把元素的视觉副本贴进容器内（过场用：不参与测量、不可交互、不进可访问性树）。
   *  container = 行（目录克隆）或「口袋」舞台 .posts-edge-stage（左缘带克隆）：
   *  舞台带 overflow:hidden，把克隆裁在条自身盒内——滑动全程只在条自己高度内，
   *  永不伸进下方内容（作者卡顶 132px），与 .posts-edge-slot.is-clip 裁出的新带
   *  同盒对齐、两条可见部分保持贴合。
   *  克隆是纯静态展示（左缘带与目录里没有 island；搜索框已挪出条外行级常驻）。
   *  清除时机：正常转场由 finished 回调移除；快速二次导航由下一次 captureOld 查 DOM 清掉；
   *  5s 兜底只覆盖"visit 被中断、after-swap 永不来"的孤儿（dev 慢加载也不会误伤：
   *  动画 400ms 内必已结束） */
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
    // 兜底：舞台整个移除（连克隆一起），普通行容器只移除克隆
    window.setTimeout(() => {
      if (container.classList.contains('posts-edge-stage')) container.remove();
      else clone.remove();
      clearSlotClip();
    }, 5000);
    return clone;
  }

  /** 目录移出屏幕的距离：整体移到视口右缘之外 + 余量（按元素左缘实测） */
  function tocOffscreenDx(el: HTMLElement): number {
    return Math.max(120, Math.ceil(window.innerWidth - el.getBoundingClientRect().left + TOC_OFFSCREEN_PAD));
  }

  /** 常驻搜索钉到静态目标态（本轮无退场/入场：列表↔列表互切、首屏加载等）：零闪 */
  function settleFloat(show: boolean): void {
    const f = row()?.querySelector<HTMLElement>('.posts-search-float');
    if (!f) return;
    f.style.transform = '';
    f.style.visibility = '';
    f.style.opacity = show ? '1' : '0';
  }

  /** 替换前调用：旧左缘元素与旧目录克隆进行内静止暂存（还没播，等新界面加载完定流向） */
  function captureOld(): void {
    // 快速二次导航：先清掉上一轮还没跑完的克隆。**查 DOM 清理，不读模块变量**——
    // finished 回调在动画结束才置 null，动画中途变量早被 playTransition 消费过，
    // 读变量清理是 no-op：旧标题克隆/目录克隆会残留到 5s 兜底（用户报的「快速切换
    // 时旧残留、过一会儿才消失」）
    stopAnims();
    const r0 = row();
    r0?.querySelectorAll<HTMLElement>('.posts-edge-stage').forEach((s) => s.remove());
    r0?.querySelectorAll<HTMLElement>('.posts-toc-clone').forEach((c) => c.remove());
    clearSlotClip();
    edgeStage = null;
    edgeClone = null;
    tocClone = null;
    const r = row();
    if (!r) return;
    oldHadSearch = false;
    const old = r.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb');
    if (old) {
      // 快速连切保护：上一次转场未播完时本条带可能带着被 cancel 的位移动画残留内联
      // transform/opacity（cancel 不清内联样式）——克隆/舞台的量盒必须按自然位置来，先清零。
      // 本条带马上就要被 swup 换掉，清零的这一帧不会被看见
      old.style.transform = '';
      old.style.opacity = '';
      oldHadSearch = !!old.querySelector('.posts-header-search');
      // 「口袋」舞台：行内绝对定位、同条自身盒（top/height 实测），overflow:hidden 裁切克隆。
      // 舞台与 playTransition 里新带槽的 is-clip 同盒 → 两条可见部分在口袋内保持贴合
      const a = old.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      const stage = document.createElement('div');
      stage.className = 'posts-edge-stage';
      stage.style.top = `${a.top - b.top}px`;
      stage.style.height = `${a.height}px`;
      r.appendChild(stage);
      edgeStage = stage;
      edgeClone = cloneIntoRow(old, stage);
    }
    const oldToc = r.querySelector<HTMLElement>('.post-sidebar');
    if (oldToc) {
      // 同上：上一轮 newToc 渐显（或移出屏幕的钉住态）被 cancel 后会残留内联
      // transform/opacity（克隆会带着半透明/偏移状态入场），克隆前先清零
      oldToc.style.transform = '';
      oldToc.style.opacity = '';
      tocClone = cloneIntoRow(oldToc, r, 'posts-toc-clone');
    }
  }

  /** 新内容加载完后调用：判定范围并播放转场（左缘滑动 + 搜索/目录退场配对） */
  function playTransition(): void {
    const r = row();
    // 新元素只在 main#swup 里找：克隆挂进行内（#swup 之外），若在整行里 querySelector，
    // 离开文章区/目录页时唯一命中的会是克隆自己，导致旧元素被误当新元素（两个动画互相覆盖）
    const main = r?.querySelector<HTMLElement>('main#swup');
    const newEdge = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb') ?? null;
    const newToc = main?.querySelector<HTMLElement>('.post-sidebar') ?? null;
    const newHadSearch = !!newEdge?.querySelector('.posts-header-search');
    const floatEl = r?.querySelector<HTMLElement>('.posts-search-float') ?? null;
    // 目录滑动只在电脑端显示目录时生效（≥851px；更窄目录是按钮+抽屉，只走普通渐隐）
    const tocSlide = !REDUCE_MOTION && window.matchMedia('(min-width: 851px)').matches;

    // ---- 搜索/目录退场配对：退出相位（240ms）走完才播进入相位（320ms），先退场再入场 ----
    // 旧侧至多一个（TOC 克隆退场：旧页是文章 / 搜索退场：旧页是列表），新侧至多一个
    // （TOC 入场：新页是文章 / 搜索入场：新页是列表）——同一界面互斥，天然各占一个相位。
    // 文章↔文章：两侧都有目录、只是内容变了，保持 400ms 并行交叉渐隐、无位移。
    const tocCrossfade = !!tocClone && !!newToc;
    let exitAnim: (() => AnimationPlaybackControls) | null = null;
    let entryAnim: (() => void) | null = null;

    if (tocClone && !tocCrossfade) {
      // 目录退场：电脑端右移移出屏幕渐隐，其他只渐隐
      exitAnim = () => {
        const el = tocClone as HTMLElement;
        const slide = tocSlide;
        const dx = slide ? tocOffscreenDx(el) : 0;
        const a = animate(el, slide ? { x: [0, `${dx}px`], opacity: [1, 0] } : { opacity: [1, 0] }, {
          duration: (slide ? EXIT_MS : EDGE_MS) / 1000,
          ease: slide ? EASE_EXIT : EASE,
          reduceMotion: REDUCE_MOTION,
        });
        anims.push(a);
        a.finished.then(() => {
          el.remove();
          tocClone = null;
        }).catch(() => {});
        return a;
      };
    }
    if (floatEl && oldHadSearch && !newHadSearch) {
      // 搜索退场：电脑端且新页有目录（配对）时右移一小段渐隐，其他只渐隐
      const withX = tocSlide && !!newToc;
      exitAnim = () => {
        // 变体类已在 onReady 把容器隐藏（visibility:hidden）——退出窗口内临时强制可见，
        // 播完再还给类（此刻应已是 hidden：新页非列表）
        floatEl.style.visibility = 'visible';
        const a = animate(floatEl, withX ? { x: [0, `${SEARCH_DX}px`], opacity: [1, 0] } : { opacity: [1, 0] }, {
          duration: (withX ? EXIT_MS : EDGE_MS) / 1000,
          ease: withX ? EASE_EXIT : EASE,
          reduceMotion: REDUCE_MOTION,
        });
        anims.push(a);
        a.finished.then(() => {
          floatEl.style.visibility = '';
        }).catch(() => {});
        return a;
      };
    }
    if (newToc && !tocCrossfade) {
      // 目录入场：电脑端自屏幕右缘左移渐显，其他只渐显。
      // 相位开始前先把新目录钉在屏外（after-swap 回调与内容换入同一任务、中间无绘制，不闪）
      if (tocSlide) {
        const dx = tocOffscreenDx(newToc);
        newToc.style.transform = `translateX(${dx}px)`;
        newToc.style.opacity = '0';
        entryAnim = () => {
          const a = animate(newToc, { x: [`${dx}px`, 0], opacity: [0, 1] }, {
            duration: ENTRY_MS / 1000,
            ease: EASE_ENTRY,
            reduceMotion: REDUCE_MOTION,
          });
          anims.push(a);
          a.finished.then(() => {
            newToc.style.transform = '';
            newToc.style.opacity = '';
          }).catch(() => {});
        };
      } else {
        entryAnim = () => {
          anims.push(animate(newToc, { opacity: [0, 1] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
        };
      }
    }
    if (floatEl && newHadSearch && !oldHadSearch) {
      // 搜索入场：电脑端且旧页有目录（配对）时自右侧偏移左移渐显，其他只渐显
      const withX = tocSlide && !!tocClone;
      if (withX) {
        // 相位开始前先钉在右侧偏移 + 隐藏（防 swap 后到相位开始之间在自然位置闪现）
        floatEl.style.transform = `translateX(${SEARCH_DX}px)`;
        floatEl.style.opacity = '0';
        entryAnim = () => {
          const a = animate(floatEl, { x: [`${SEARCH_DX}px`, 0], opacity: [0, 1] }, {
            duration: ENTRY_MS / 1000,
            ease: EASE_ENTRY,
            reduceMotion: REDUCE_MOTION,
          });
          anims.push(a);
          a.finished.then(() => {
            floatEl.style.transform = '';
          }).catch(() => {});
        };
      } else {
        entryAnim = () => {
          anims.push(animate(floatEl, { opacity: [0, 1] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
        };
      }
    }
    // 本轮无搜索退场/入场（列表↔列表互切等）：钉回目标态，零闪
    if (floatEl && !exitAnim && !entryAnim) settleFloat(newHadSearch);

    // ---- 左缘条滑动（原有逻辑） ----
    if (edgeClone) {
      if (newEdge) {
        // 新旧都在文章区：播放并消耗流向（本次与上次相反；首次"上"）
        const flow: Flow = lastFlow === 'up' ? 'down' : 'up';
        lastFlow = flow;
        // 用局部引用接住克隆与舞台：finished 回调（动画结束才触发）里若读模块变量，
        // 变量可能已被后续逻辑改写——回调一律用局部引用，模块变量在"元素真正移除时"才置 null
        const exitEl = edgeClone;
        const exitStage = edgeStage;
        const H = exitEl.offsetHeight; // 左缘带高（36px）：滑动距离 = 带高，新旧两带全程保持贴合
        const exitTo = flow === 'up' ? -H : H; // 旧元素退出方向
        // 新带槽转场期裁切（与舞台同盒 = 「口袋」）：滑动只在条自身盒内、永不压下方内容（作者卡）；
        // 常态槽是 overflow:visible（标题文字阴影等边缘效果不被裁），转场窗口内才收紧裁切
        const newSlot = newEdge.parentElement;
        if (newSlot?.classList.contains('posts-edge-slot')) newSlot.classList.add('is-clip');
        // 退出侧：位移 + 渐隐同时走（用户要求「边滑动边渐隐」）；进入侧纯位移全程不透明
        const exit = animate(exitEl, { y: [0, `${exitTo}px`], opacity: [1, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION });
        anims.push(exit);
        // 滑出结束即移除舞台（连克隆一起）（cancel 时 finished 会 reject，忽略——元素已由下一次 captureOld 查 DOM 清掉）
        exit.finished.then(() => {
          if (exitStage) exitStage.remove();
          else exitEl.remove();
          newSlot?.classList.remove('is-clip');
          edgeStage = null;
          edgeClone = null;
        }).catch(() => {});
        // 进入侧：全程不透明（只位移不淡入）；两条带各走自身全高，任意时刻并集覆盖口袋
        const enter = animate(newEdge, { y: [`${-exitTo}px`, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION });
        anims.push(enter);
        enter.finished.then(() => {
          newSlot?.classList.remove('is-clip');
        }).catch(() => {});
      } else {
        if (edgeStage) edgeStage.remove();
        else edgeClone.remove(); // 新界面是普通屏：不播，直接随替换消失
        edgeStage = null;
        edgeClone = null;
      }
    }
    // 旧页有目录、新页也是文章（两侧都有）：并行交叉渐隐、无位移（不参与相位）
    if (tocCrossfade) {
      const fadeEl = tocClone as HTMLElement;
      const fade = animate(fadeEl, { opacity: [1, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION });
      anims.push(fade);
      fade.finished.then(() => {
        fadeEl.remove();
        tocClone = null;
      }).catch(() => {});
      anims.push(animate(newToc as HTMLElement, { opacity: [0, 1] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
    }

    // ---- 相位调度：退出相位走完才播进入相位（cancel = 快速二次导航，进入不启动，由下一轮 captureOld 清场） ----
    if (exitAnim) {
      const a = exitAnim();
      a.finished.then(() => {
        entryAnim?.();
      }).catch(() => {});
    } else {
      entryAnim?.();
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
    syncSearchPos();
    syncActive();
    ensureCategoryTree();
    if (isSwap) {
      // 首屏整页加载不播转场，只有 swup 切页才播；此刻新内容已加载完，播放不会先于内容
      playTransition();
    } else {
      // 首屏：搜索钉到变体目标态（在首次绘制前，无闪）
      const r = row();
      if (r) settleFloat(r.classList.contains('page-main--listing'));
    }
  }

  // 两个事件都由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('astro:before-swap', captureOld);
  document.addEventListener('astro:after-swap', () => onReady(true));
  onReady();
})();

// 标记为模块：文件顶层有 import，TS 模块检查要求显式模块语义
export {};
