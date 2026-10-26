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
//    模糊，手机端滑动形态随之整体退役）走**模糊变过去**——旧带原地渐隐
//    （opacity 1→0，160ms；退出侧全程不带 filter——带过滤层的克隆被移除时，
//    下方新标题会因合成层重栅格闪一下）、新带原地模糊渐显（blur 4px→0 +
//    opacity 0→1，260ms），两带同位交叉渐隐、无双重曝光。手机端列表↔文章另做**固定方向**整页推拉：
//    开文章 = 整页向上（新内容自下方 48px 滑入）、关文章 = 镜像向下（新列表自上方 48px
//    滑下）——新带槽另做与推入**等距反向**的 counter 位移，屏幕上原地不动——避免新带
//    跟随推入上滑显得「面包屑浮上去」，读起来是「标题模糊成面包屑」。推入/counter 的
//    transform 层**延迟拆除**（finished 后 300ms，见 TRANSFORM_CLEAR_DELAY_MS）：立即拆层
//    会触发整列内容（长列表的十几张玻璃卡）重栅格化，压在新标题入场收尾的提交上，
//    列表长到一屏放不下时标题会「闪一下」。推拉只在区内
//    （旧屏为列表或文章详情）播放；跨区（普通页→列表）直接落位不推入——旧屏无条带、
//    常驻搜索框无入场相位，整页滑入会标题/列表滑动而搜索框原地不动，割裂。
// b) 搜索/目录退场配对（用户要求「先退场再入场」）：目录出现/消失的切页里，退出相位
//    （320ms）走完才播进入相位（320ms）——列表→文章：搜索右移 48px「移一段」渐隐
//    （退出）→ 目录自屏幕右缘左移渐显（入场）；文章→列表：目录右移移出屏幕渐隐
//    （退出）→ 搜索自 48px 右偏移左移渐显（入场）。四个动效（搜索/目录 × 出场/退场）
//    完全统一：同时长（PHASE_MS）、渐显渐隐与位移同步（用户要求四个效果全一样）。
//    只在电脑端显示目录（≥851px）时带位移。目录克隆**创建即钉视口**（captureOld /
//    before-swap，position: fixed，脱离文档坐标）——必须赶在「滚顶启动 + 切页文档高度
//    塌缩致滚动位被浏览器钳制」之前：滚顶排在 content:replace 之后才调度，after-swap
//    起播晚于它（dev 下 swap 窗口更大），等起播时再钉，克隆可能已被位移（用户所见
//    「目录先下移一段才停住」，极端钉到屏外）。两套退场分支（文章↔文章 crossfade +
//    文章→列表 / 普通页）都直接播已钉住的克隆：退场右移移出屏幕渐隐（320ms）；文章↔
//    文章「先退场再入场」——退场播完才播新目录自屏幕右缘左移渐显（入场 320ms），并行
//    会两条对滑在途中交叉、同时半透明重叠成「重影」。退场期间新目录钉
//    不可见（gate 分支构造即钉），落到 sticky 钉住位（top 到达 82px）才真正开始入场
//    ——切页后 SwupScrollPlugin 平滑滚回顶部（时长按距离，长文可达 ~2s），挂在文档坐标
//    的克隆/元素会被滚动「带走」（退场原地渐隐读起来是「目录向右下漂移」、新目录带着
//    淡入从视口上方「掉下来」），钉视口/等落位后出入场都是纯水平平移，与滚顶解耦、
//    滚顶逻辑不动。等待期间新目录恒在视口上方（本就不可见），不露空位。搜索浮层同法：
//    四个动画方法起播前 pinFloat 钉视口（内联 top/left 转视口坐标）、finish/settle 统一
//    unpin 还原行相对值——钉住期间 syncSearchPos 让路（fixed 下写行相对值会瞬移），
//    且占位符查找排除条带克隆里的占位符克隆（首次 RO 回调可能赶在克隆渐隐窗口内）。
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
//    动画残留内联 transform/opacity（motion 的 cancel 不清内联样式——它把元素回退到
//    **首关键帧**并把 keyframes[0] 重写进内联），克隆前必须清零再量盒；
//    ② 上一轮的克隆/舞台清理必须**查 DOM** 而不是读模块变量——finished 回调在动画结束才跑，
//    变量可能已为 null，读变量清理是 no-op，旧标题克隆会残留到 5s 兜底（用户看到的
//    「快速切换时旧残留，过一会儿才消失」），条带克隆与目录克隆都带标记类供查 DOM 清除；
//    ③ 搜索浮层的在途相位（exiting/entering）要与本轮目的地核对，冲突时从飞行中
//    位姿改向到目的地静止态（playTransition 开头收口，floatCtl.redirect）：退场未完就
//    切回列表 → 自当前位置归位（「停下再回去」）；入场未完就切进文章 → 自当前位置
//    继续离场、补完退场；跨区（→ 普通页）仍 settle 直接消失。位姿必须先 cancel 前从
//    computed style 读再重钉回内联——motion 的 cancel 会把元素回退到首关键帧（重写
//    keyframes[0] 进内联），cancel 后读内联拿到的是首关键帧不是在途值（读早了会
//    「退场动画直接消失」）；与 nav-indicator 快速连点改向同范式。否则 state 卡在
//    exiting/entering，入场 gate（state==='hidden'）不成立、目录动作又占着相位链，
//    settle 兜底跑不到，搜索框会永久停在 opacity 0；
//    ④ 文章↔文章新目录入场的落位等待（rAF + 超时双退出条件）也在 captureOld 清掉——
//    等的那个元素会随旧内容被换走，不清就追一个不存在的节点空转
// e) 搜索框行级常驻：永不被 swup 重建（节点不被摘出/重插，backdrop 层与投影不重建，
//    切页零闪）。CSS 不写 opacity 过渡（与 motion 关键帧抢写同一属性），只负责
//    visibility/pointer-events 随行变体类瞬时翻转；opacity/位移/白纱全由本文件驱动。
// f) 首屏早期点击：实例未就绪时点区内链接（swup 委托未挂载，原生 = 整页跳转，
//    落地首屏不播转场）——拦截点击、等实例就绪后 navigate() 转正常切页、转场照常播，
//    超时回退原生跳转（onEarlyClick）。实例赋值前 window.swup 会被 DOM id 回退解析成
//    <main id="swup"> 元素，就绪判定必须走 realSwup() 特征甄别。
//
// category-tree 脚本守卫：从非文章页 swup 进文章区时，壳里脚本不在首屏 HTML，
// 这里按需懒加载（模块单例，加载后自身的 document 委托与 after-swap 监听长期存活）。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  // ================= 0. 常量与环境 =================

  const EDGE_MS = 400; // 左缘滑动 / 内容滑动 / 普通渐隐时长
  const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]; // 平滑进出
  // 桌面端搜索/目录配对相位：四个动效（搜索/目录 × 出场/退场）完全统一——同时长、
  // 渐显渐隐与位移同步（用户要求四个效果全一样）；入场减速落位、退场加速离场
  const PHASE_MS = 320;
  const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];
  const EASE_ENTRY: [number, number, number, number] = [0, 0, 0.2, 1];
  const SEARCH_DX = 48; // 搜索「移一段」的位移距离
  const TOC_OFFSCREEN_PAD = 40; // 目录移出屏幕的额外余量（整体在视口右缘之外）
  // 手机端（≤768px）：新内容滑动距离 / 搜索框小位移 / 搜索位移与渐隐时长
  // （渐隐比位移快：上移时避免半透明胶囊蹭到上方标题；手机端页头是列式、
  //  标题↔搜索间隙 16px，位移必须小于它，否则入场落回会蹭到标题底边闪一下）
  const MOBILE_SLIDE = 48;
  const FLOAT_MOVE = 12;
  const FLOAT_EXIT_MS = 300;
  const FLOAT_EXIT_FADE_MS = 180;
  const FLOAT_ENTRY_FADE_MS = 220;
  // 手机端「关文章」：搜索自上方落回的延迟（用户反馈：下移时叠在文章卡片上）。
  // 整页自上方 48px 推下时，列表栅格顶（160.6-48=112.6）起初在搜索框钉住位底边（146.6）
  // 之上；搜索框落回（12px）若与推下同帧起步，渐显前段的半透明胶囊会压在栅格顶。
  // 推迟到栅格顶已下移越过胶囊在途底边（≈150ms 时栅格顶 ≈140 > 胶囊底 135）再落回，
  // 可见帧全程无叠压；150+300=450ms，比 400ms 推入仅晚 50ms 收尾
  const FLOAT_ENTRY_DELAY_MS = 150;
  // 条带交换「模糊变过去」（**全部**左缘条带切换——桌面端所有 + 手机端列表↔文章 + 手机端
  // 列表↔分类/标签；用户指定电脑端也用模糊，滑动形态整体退役）：
  // 旧带原地渐隐（opacity 1→0；退出侧不写 filter 关键帧——带过滤层的克隆被移除时，
  // 下方新标题会因合成层重栅格闪一下）、新带原地模糊渐显（blur 4px→0 + opacity 0→1）
  const STRIP_BLUR_OUT_MS = 160; // 旧条带：渐隐时长（只走 opacity）
  const STRIP_BLUR_IN_MS = 260; // 新条带：模糊渐显
  const STRIP_BLUR_PX = 4; // 模糊峰值（px）
  // 推入/counter 的 transform 层拆除延迟：finished 微任务里立即清 transform = 当场拆掉
  // 根/槽的合成层，整列内容（手机端长列表 = 十几张带 backdrop-filter 的玻璃卡）随之
  // 重栅格化——恰好压在新标题入场收尾的提交上，重栅格赶不上当帧预算时标题「闪一下」
  // （只有列表长到一屏放不下才够贵、才可见；一屏放得下时重栅格当帧完成、无感）。
  // 推迟到入场完全落定、合成器已提交若干静止帧后再拆：重栅格输出与屏上像素恒等，拆除不可见
  const TRANSFORM_CLEAR_DELAY_MS = 300;
  // 点击触发的搜索退场：若 1.2s 内切页未提交（swup 忽略 / 目标失效），恢复搜索框
  const FLOAT_RESTORE_MS = 1200;
  // 文章↔文章新目录入场的「落位等待」上限：滚顶被用户滚动打断/异常停住时不能永久
  // 藏目录，超时直接播（此时目录若在视口上方，滑入不可见、无副作用）
  const TOC_SETTLE_TIMEOUT_MS = 2500;

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  // 目录滑动只在电脑端显示目录（≥851px；更窄目录是按钮+抽屉，只走普通渐隐）
  const tocSlideGate = () => !REDUCE_MOTION && window.matchMedia('(min-width: 851px)').matches;
  const BG0 = 'rgba(255, 255, 255, 0)'; // 白纱关键帧的透明端（与 .glass 的 transparent 等价）
  const VEIL = (() => {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue('--glass-veil').trim() || 'rgba(255, 255, 255, 0.15)';
    } catch {
      return 'rgba(255, 255, 255, 0.15)';
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
  // 延迟清 transform（见 TRANSFORM_CLEAR_DELAY_MS）；快速连切后元素已随旧 DOM 换走，
  // isConnected 判掉不写
  const scheduleTransformClear = (el: HTMLElement) => {
    setTimeout(() => {
      if (el.isConnected) el.style.transform = '';
    }, TRANSFORM_CLEAR_DELAY_MS);
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
    // 占位符只认真实页头的：转场克隆条带（edgeClone）带着占位符克隆且播完才移除，
    // RO 回调可能在克隆还在时触发，把它当真实占位会量到克隆位置
    const phs = r ? Array.from(r.querySelectorAll<HTMLElement>('.posts-header-search')) : [];
    const ph = phs.find((el) => !el.closest('.posts-edge-clone')) ?? null;
    // 退场/入场动画期间浮层钉在视口（内联 top/left 是视口坐标）：此刻写行相对值
    // 会把浮层瞬移；unpin 后下一轮重测自然补齐
    if (floatEl?.style.position === 'fixed') return;
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

  /** 断点跨界（768 / 1151）一次样式重算就翻转布局结构（页头行↔列、行 padding 82↔73、
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
    row()
      ?.querySelectorAll<HTMLElement>('.posts-edge-clone, .posts-toc-clone')
      .forEach((c) => c.remove());
  }

  /** 目录移出屏幕的距离：整体移到视口右缘之外 + 余量（按元素左缘实测） */
  function tocOffscreenDx(el: HTMLElement): number {
    return Math.max(120, Math.ceil(window.innerWidth - el.getBoundingClientRect().left + TOC_OFFSCREEN_PAD));
  }

  /** 目录入场动作的构造（相位开始前先钉在屏外/透明，同任务内无绘制间隙、不闪）：
   *  电脑端自屏幕右缘左移渐显——位移与渐显同步（PHASE_MS/EASE_ENTRY），与搜索框
   *  移动切换同节奏；其他只渐显（400ms）。
   *  用于「旧界面没有目录、新界面出现」的进入相位（列表→文章，退出相位由搜索承担；
   *  有旧目录克隆的切页走退场相位或并行交叉渐隐，不经这里） */
  function makeTocEntry(newToc: HTMLElement): () => void {
    if (tocSlideGate()) {
      const dx = tocOffscreenDx(newToc);
      newToc.style.transform = `translateX(${dx}px)`;
      newToc.style.opacity = '0';
      return () => {
        const move = track(
          animate(
            newToc,
            { x: [`${dx}px`, 0] },
            { duration: PHASE_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION },
          ),
        );
        const fade = track(
          animate(
            newToc,
            { opacity: [0, 1] },
            { duration: PHASE_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION },
          ),
        );
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

  /** 文章↔文章的新目录入场：落位等待 + 标准右缘滑入。在旧目录退场播完后调用
   *  （先退场再入场）。滚回顶部过程中新目录在视口上方（或正从上方落下）——退场前
   *  已钉不可见（gate 分支 makeTocEntry 构造即钉、非 gate 分支调用方钉内联 opacity
   *  0），等待期不可见，也不露空位（等待期它本来就在视口上方）。等它落到 sticky
   *  钉住位再播滑入：落位后视口位置静止（钉在 82px），入场才是纯水平平移。落位判定
   *  用 scrollY（免逐帧布局读取）：目录文档坐标 yToc 实测一次，滚到 scrollY ≤ yToc
   *  - 82 即到达钉住位（目录视口 top 恒 ≤ 82px，越过即终态）；已在钉住位（短文 /
   *  页面本就在顶部）则下一帧立即播。超时兜底：滚顶被用户滚动打断/异常停住时不能
   *  永久藏目录——超时直接播（目录若在视口上方，滑入不可见）。退出条件：落位或超时
   *  触发入场；captureOld（新一轮切页）清 rAF 与定时器 */
  function startTocEntryWait(newToc: HTMLElement, play: () => void): void {
    cancelTocEntryWait();
    const yToc = newToc.getBoundingClientRect().top + window.scrollY;
    const begin = (): void => {
      tocEntryWait = null;
      play();
    };
    const timerId = window.setTimeout(begin, TOC_SETTLE_TIMEOUT_MS);
    const check = (): void => {
      if (!tocEntryWait) return; // 已被 captureOld 清掉
      if (window.scrollY <= yToc - 82) {
        window.clearTimeout(timerId);
        begin();
        return;
      }
      tocEntryWait.rafId = window.requestAnimationFrame(check);
    };
    tocEntryWait = { rafId: 0, timerId };
    tocEntryWait.rafId = window.requestAnimationFrame(check);
  }

  // ================= 4. 搜索浮层控制（行级常驻单节点） =================
  // CSS 只管 visibility/pointer-events（随变体类瞬时翻转）+ 端点 opacity: 0；
  // opacity / 位移 / 白纱全在这里。白纱规则：**淡出与淡入都用**（容器背景 透明 ↔ VEIL）——
  // 移动渐隐的毛玻璃用实体白替代消失的模糊；淡入：入场前先加上半透明白（同任务 pre-pin、无绘制间隙），再随入场全程褪去，见文件头 c
   //（白纱/淡变只用于区内动画；跨区边界直接 settle，无动画、无白纱，见文件头 c 末）
  // 浮层钉视口期间的原行相对内联 top/left（unpin 时恢复）
  let floatPinSaved: { top: string; left: string } | null = null;

  /** 浮层钉视口：absolute→fixed 钉到当前视口位置，退场/入场动画期间脱离页面滚动——
   *  切页后 SwupScrollPlugin 平滑滚回顶部，文档坐标里的浮层会被滚动「带走」，
   *  退场/入场变成向右下的斜线（目录克隆同病，见文件头 b）。行及其祖先无
   *  transform/filter，fixed 即视口坐标。动画收尾（finish）或静态归位（settle）时
   *  恢复原行相对内联（恢复时浮层已不可见：退场播完 opacity 0 / 入场前 opacity 0） */
  function pinFloat(f: HTMLElement): void {
    if (f.style.position === 'fixed') return; // 已在钉住态（redirect 中途被改向）
    floatPinSaved = { top: f.style.top, left: f.style.left };
    const r = f.getBoundingClientRect();
    f.style.position = 'fixed';
    f.style.top = `${r.top}px`;
    f.style.left = `${r.left}px`;
  }

  function unpinFloat(f: HTMLElement): void {
    if (f.style.position !== 'fixed') return;
    f.style.position = '';
    f.style.top = floatPinSaved?.top ?? '';
    f.style.left = floatPinSaved?.left ?? '';
    floatPinSaved = null;
  }

  const floatCtl = {
    state: 'shown' as 'shown' | 'hidden' | 'exiting' | 'entering',
    active: null as AnimationPlaybackControls | null,
    restoreTimer: 0 as number,

    el(): HTMLElement | null {
      return row()?.querySelector<HTMLElement>('.posts-search-float') ?? null;
    },

    /** 钉到静态目标态：清掉一切内联（transform/opacity/visibility/背景白纱 + 视口钉） */
    settle(show: boolean): void {
      window.clearTimeout(this.restoreTimer);
      stopFloatAnims();
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

    /** 切页已提交（before-swap 到来）：撤销点击退场的恢复定时器 */
    commit(): void {
      window.clearTimeout(this.restoreTimer);
    },

    /** 幂等收尾：位移与渐隐两个动画各在自己的 finished 跑一次——谁后结束谁负责
     *  清内联（motion 会把关键帧端点提交成内联样式，只清一次会被后完成的动画重新写回） */
    finish(show: boolean, f: HTMLElement): void {
      this.state = show ? 'shown' : 'hidden';
      this.active = null;
      unpinFloat(f); // 动画播完：脱离视口钉，回到行内绝对定位（此时浮层已不可见）
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
      pinFloat(f); // 退场动画期间钉视口：滚顶滑行不会把上移+渐隐「带走」成斜线
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
      pinFloat(f); // 退场动画期间钉视口：滚顶滑行不会把右移+渐隐「带走」成向右下的斜线
      const opts = { duration: PHASE_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION };
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
      pinFloat(f); // 入场动画期间钉视口（先于 pre-pin transform：量盒须取无位移的自然位）
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
      const opts = { duration: PHASE_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION };
      // 相位开始前先钉住（同任务内无绘制间隙，不闪）
      pinFloat(f); // 入场动画期间钉视口（先于 pre-pin transform：量盒须取无位移的自然位）
      if (withX) f.style.transform = `translateX(${SEARCH_DX}px)`;
      f.style.opacity = '0';
      f.style.backgroundColor = VEIL; // 入场前先加上半透明白（见文件头 c），关键帧随入场全程褪去
      const move = withX ? trackFloat(animate(f, { x: [`${SEARCH_DX}px`, 0] }, opts)) : null;
      const fade = trackFloat(animate(f, { opacity: [0, 1], backgroundColor: [VEIL, BG0] }, opts));
      this.active = move ?? fade;
      if (move) move.finished.then(() => this.finish(true, f)).catch(() => {});
      fade.finished.then(() => this.finish(true, f)).catch(() => {});
    },

    /** 快速连切：在途相位（退场/入场）被新一轮切页打断时，不静默掐断硬切——
     *  从飞行中位姿改向到本轮目的地的静止态（与目录克隆的中断处理同范式：停下、
     *  再走完整动效）：退场未完就切回列表 → 自当前位置归位（「停下再回去」）；
     *  入场未完就切进文章 → 自当前位置继续离场，补完退场动画。
     *  飞行中位姿只能从 computed style（最后一帧渲染值）读：motion 的 cancel 会把
     *  元素回退到首关键帧（把 keyframes[0] 重写进内联），cancel 之后内联里已不是
     *  在途位姿——与 nav-indicator 快速连点改向同范式（先读 computed 再改向）。
     *  时长按剩余位移/剩余渐隐占全程的比例折算（25%–100%） */
    redirect(show: boolean): AnimationPlaybackControls | null {
      const f = this.el();
      if (!f || (this.state !== 'exiting' && this.state !== 'entering')) return this.active;
      const { dx, dy, op, bg } = readFloatPose(f); // 先读：cancel 会把内联改写回首关键帧
      stopFloatAnims();
      // 重钉在途位姿：cancel 改写的首关键帧位姿不可暴露——延迟期 motion 不写帧，
      // 元素会停在内联值上直到动画首帧
      f.style.transform = `translate(${dx}px, ${dy}px)`;
      f.style.opacity = `${op}`;
      f.style.backgroundColor = bg;
      if (!show) f.style.visibility = 'visible'; // 行变体已翻走隐藏容器——补完退场窗口内强制可见（同 exitDesktop）
      const mobile = isMobile();
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
      // 手机端归位与 enterMobile 同样延迟：等整页推下把栅格顶移过胶囊底边再落回，可见帧不叠卡片
      const delay = mobile && show ? FLOAT_ENTRY_DELAY_MS / 1000 : 0;
      const a = trackFloat(
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
            reduceMotion: REDUCE_MOTION,
          },
        ),
      );
      this.state = show ? 'entering' : 'exiting';
      this.active = a;
      a.finished.then(() => this.finish(show, f)).catch(() => {});
      return a;
    },

  };

  /** 读浮层当前位姿 = 最后一帧渲染值：在途位姿只能从 computed style 读——
   *  motion 的 cancel 会把元素回退到首关键帧（keyframes[0] 重写进内联），
   *  cancel 之后内联里已不是在途值（nav-indicator 的 currentX 同口径）。
   *  transform 按 matrix 第 5/6 分量解析（translateX/translateY）；opacity 取不到按 1 */
  function readFloatPose(f: HTMLElement): { dx: number; dy: number; op: number; bg: string } {
    const cs = getComputedStyle(f);
    let dx = 0;
    let dy = 0;
    const t = cs.transform;
    if (t && t !== 'none') {
      const m = /matrix\(([^)]+)\)/.exec(t);
      if (m) {
        const p = m[1].split(',');
        dx = parseFloat(p[4]) || 0;
        dy = parseFloat(p[5]) || 0;
      }
    }
    const o = parseFloat(cs.opacity);
    return { dx, dy, op: Number.isFinite(o) ? o : 1, bg: cs.backgroundColor || BG0 };
  }

  // ================= 5. 转场编排 =================
  let edgeClone: HTMLElement | null = null;
  let tocClone: HTMLElement | null = null;
  let oldHadSearch = false; // 旧页是列表系界面（搜索正在显示）——captureOld 时记录
  let oldIsPost = false; // 旧页是文章详情（面包屑条）——区分「区内」与「跨区」搜索处理
  // 文章↔文章新目录入场的落位等待（rAF + 超时，双退出条件；captureOld 清）
  let tocEntryWait: { rafId: number; timerId: number } | null = null;

  function cancelTocEntryWait(): void {
    if (!tocEntryWait) return;
    window.cancelAnimationFrame(tocEntryWait.rafId);
    window.clearTimeout(tocEntryWait.timerId);
    tocEntryWait = null;
  }

  /** 替换前调用（astro:before-swap，content:replace 前一刻）：清场 + 克隆静止暂存 */
  function captureOld(): void {
    stopAnims(); // 只停转场动画；搜索浮层的点击退场独立生命周期，不连带
    clearClones();
    edgeClone = null;
    tocClone = null;
    oldHadSearch = false;
    oldIsPost = false;
    pendingEarlyNav = null; // 切页已提交：早期点击等待结束
    floatCtl.commit(); // 切页已提交：撤销点击退场的恢复定时器
    cancelTocEntryWait(); // 上一轮文章↔文章新目录的落位等待作废（元素即将被换走）
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
      edgeClone = cloneIntoRow(old, r, 'posts-edge-clone');
      // 克隆全程钉死 filter: none：上一轮渐显保留的 blur(0px) 会随克隆一起复制进来，
      // 带过滤层的克隆被移除时，下方新标题会因合成层重栅格闪一下（首次切换旧带
      // 本来无 filter，所以只有后续切换出现）。单靠 removeProperty 不够——退出动画
      // 若写回 filter 关键帧等于没清（退出侧已随之改为纯 opacity 渐隐，见 playTransition）
      if (edgeClone) edgeClone.style.filter = 'none';
    }
    const oldToc = main?.querySelector<HTMLElement>('.post-sidebar');
    if (oldToc && getComputedStyle(oldToc).display !== 'none') {
      oldToc.style.transform = '';
      oldToc.style.opacity = '';
      tocClone = cloneIntoRow(oldToc, r, 'posts-toc-clone');
      // 创建即钉视口（机制见文件头 b）：before-swap 早于滚顶启动与切页文档高度塌缩，
      // 克隆从此 fixed 不被任何布局变化带走；退场/交叉渐隐块里的再钉变为 no-op
      if (tocClone) {
        const cr = tocClone.getBoundingClientRect();
        tocClone.style.position = 'fixed';
        tocClone.style.top = `${cr.top}px`;
        tocClone.style.left = `${cr.left}px`;
      }
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
    const opening = oldHadSearch && !newHadSearch; // 列表→文章（旧页必为列表系）
    const closing = !oldHadSearch && newHadSearch && oldIsPost; // 文章→列表（旧页必为文章详情）
    // 手机端（≤768px）列表↔文章：固定方向整页推拉（开=上 / 关=下）；
    // opening/closing 均要求旧页在文章区内——跨区（普通页→列表）旧屏无条带可配对、
    // 常驻搜索框直接 settle 落位，整页滑入会出现内容滑动而搜索框原地不动的割裂
    const mobilePush = isMobile() && !REDUCE_MOTION && (opening || closing);

    // 快速连切收口：浮层带着上一轮的在途相位、与本轮目的地冲突时，不静默掐断硬切
    // （用户所见「点快了搜索框没有退场动画」）——从飞行中位姿改向到本轮目的地的
    // 静止态（与目录克隆的中断处理同范式：停下、再走完整动效）：退场未完就切回列表 →
    // 自当前位置归位（「停下再回去」）；入场未完就切进文章 → 自当前位置继续离场、
    // 补完退场动画。跨区（→ 普通页）不改向：按「切到其他界面不渐隐」（用户指定）
    // settle(false) 直接消失。否则 state 卡在 exiting/entering，入场 gate
    // （state==='hidden'）不成立、目录动作又占着相位链，settle 兜底跑不到，
    // 搜索框会永久停在 opacity 0
    if (floatCtl.state === 'exiting' && newHadSearch) floatCtl.redirect(true);
    if (floatCtl.state === 'entering' && !newHadSearch) {
      if (newIsPost) floatCtl.redirect(false);
      else floatCtl.settle(false);
    }

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
        // 目录退场：电脑端右移移出屏渐隐——位移与渐隐同步（PHASE_MS/EASE_EXIT），
        // 与搜索框移动切换同节奏；其他只渐隐
        exitAction = () => {
          const el = tocClone as HTMLElement;
          // 先钉到当前视口位置（同文章↔文章分支）：克隆挂行内（文档坐标），深滚动位
          // 出发时退场窗口内页面正高速回顶（SwupScrollPlugin）——不钉的话右滑 + 渐隐
          // 会被滚动「带走」（视口 top 随 scrollY 减小而增大，退场读作向右下漂）；
          // 减动效只渐隐不位移时也钉（原地渐隐同样会被带走）。rect 必须在任何
          // transform 写入之前量
          const rect = el.getBoundingClientRect();
          el.style.position = 'fixed';
          el.style.top = `${rect.top}px`;
          el.style.left = `${rect.left}px`;
          const slide = tocSlideGate();
          const dx = slide ? tocOffscreenDx(el) : 0;
          const move = slide
            ? track(
                animate(
                  el,
                  { x: [0, `${dx}px`] },
                  { duration: PHASE_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION },
                ),
              )
            : null;
          const fade = track(
            animate(
              el,
              { opacity: [1, 0] },
              {
                duration: (slide ? PHASE_MS : EDGE_MS) / 1000,
                ease: slide ? EASE_EXIT : EASE,
                reduceMotion: REDUCE_MOTION,
              },
            ),
          );
          const last = move ?? fade; // 相位链：有位移时位移与渐隐同时长、等它走完；无位移时等渐隐
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
      if (
        oldHadSearch &&
        !newHadSearch &&
        newIsPost &&
        (floatCtl.state === 'shown' || floatCtl.state === 'exiting')
      ) {
        const withX = tocSlideGate() && hasNewToc; // 与新目录入场配对时才右移
        // 在途退场（redirect 改向「进文章」而来）：相位链等它播完再播目录入场（先退场再入场）
        exitAction = () =>
          floatCtl.state === 'exiting' ? floatCtl.active : floatCtl.exitDesktop(withX);
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
    // 本轮无搜索退场/入场（列表↔列表互切、首屏、**跨区边界**——区内才做淡变）：钉回目标态，零闪；
    // 浮层在途（redirect 改向中）不碰——它自己会收尾到目标态
    if (!exitAction && !entryAction && (floatCtl.state === 'shown' || floatCtl.state === 'hidden')) {
      floatCtl.settle(newHadSearch);
    }

    // ---- 左缘条带切换（列表页头 ↔ 文章面包屑条）：全部走「模糊变过去」----
    // 旧带原地模糊渐隐、新带原地模糊渐显，无位移（用户指定：电脑端也用模糊；手机端
    // 列表↔分类/标签的「一张纸」滑动形态随之整体退役）。手机端列表↔文章另做整页推入的
    // 反向抵消（counter）：根自 ±MOBILE_SLIDE 推到 0 时槽走反方向同距离（同任务启动、
    // 同时长同缓动，见下方推拉块），新条带在屏幕上原地不动——读起来是「标题模糊成
    // 面包屑」，不是「面包屑浮上来」
    if (edgeClone && newEdge) {
      const exitEl = edgeClone;
      // 退出侧不写 filter 关键帧：blur 会在首帧就把过滤层挂回克隆，渐隐完成移除克隆时
      // 下方新标题会因合成层重栅格闪一下（与 captureOld 的 filter: none 钉死同因）
      const out = track(
        animate(
          exitEl,
          { opacity: [1, 0] },
          { duration: STRIP_BLUR_OUT_MS / 1000, ease: EASE_EXIT, reduceMotion: REDUCE_MOTION },
        ),
      );
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
              scheduleTransformClear(newSlot);
            })
            .catch(() => {});
        }
      }
      // 终态保留 blur(0px)：finished 后 motion 还会补写一次终帧，先清会制造
      // none → blur(0px) 的一帧重栅格闪；条随切页替换，不必在这里清内联
      track(animate(newEdge, { opacity: [0, 1], filter: [`blur(${STRIP_BLUR_PX}px)`, 'blur(0px)'] }, { duration: STRIP_BLUR_IN_MS / 1000, ease: EASE_ENTRY, reduceMotion: REDUCE_MOTION }));
    } else if (edgeClone) {
      edgeClone.remove(); // 新界面是普通屏：不播，直接随替换消失
      edgeClone = null;
    }

    // ---- 手机端整页推拉：新内容自下方/上方滑入（开=上滑入 / 关=下滑入）----
    // transform 层的拆除走 scheduleTransformClear 延迟：立即拆层会触发整列内容
    // （长列表的十几张玻璃卡）重栅格化，压在新标题入场收尾的提交上造成标题闪一下
    //（见 TRANSFORM_CLEAR_DELAY_MS 注释）
    if (mobilePush) {
      const root = opening ? (main?.querySelector<HTMLElement>('.posts-article') ?? null) : (main?.querySelector<HTMLElement>('.posts-page') ?? null);
      if (root) {
        const y0 = opening ? MOBILE_SLIDE : -MOBILE_SLIDE;
        const a = track(animate(root, { y: [`${y0}px`, 0] }, { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION }));
        a.finished
          .then(() => {
            scheduleTransformClear(root);
          })
          .catch(() => {});
      }
    }

    // ---- 目录出入场（文章↔文章，两侧都有目录）：先退场再入场，与滚顶解耦 ----
    // 切页后 SwupScrollPlugin 平滑滚回顶部（时长按距离，长文可达 ~2s），旧目录克隆
    // 绝对定位挂在行内（文档坐标）——原地渐隐会被滚顶「带走」：视口 top 从 181px
    // 一路漂出屏幕（用户所见「目录退场向右下方移动」）。先把克隆钉到它当前的视口
    // 位置（position: fixed，行及其祖先无 transform，fixed 即视口坐标），脱离页面
    // 滚动，再右移移出屏幕渐隐（PHASE_MS/EASE_EXIT，与文章→列表目录退场同节奏）。
    // 新目录在退场前就钉不可见（gate 分支构造即钉屏外右 + 透明；非 gate 分支靠显式
    // 内联 opacity 0 兜住退场 + 等待窗口），退场播完才开始落位等待、落到 sticky 钉
    // 住位才自右缘滑入（startTocEntryWait）——两拍对滑若并行会在途中交叉重叠成
    // 「重影」，顺序执行则退场结束时入场还没开始，任何时刻只有一个目录可见
    if (tocClone && hasNewToc) {
      const fadeEl = tocClone;
      const newToc = newTocEl as HTMLElement;
      const playEntry = makeTocEntry(newToc);
      newToc.style.opacity = '0';
      const rect = fadeEl.getBoundingClientRect();
      fadeEl.style.position = 'fixed';
      fadeEl.style.top = `${rect.top}px`;
      fadeEl.style.left = `${rect.left}px`;
      const slide = tocSlideGate();
      const dx = slide ? tocOffscreenDx(fadeEl) : 0;
      const opts = {
        duration: (slide ? PHASE_MS : EDGE_MS) / 1000,
        ease: slide ? EASE_EXIT : EASE,
        reduceMotion: REDUCE_MOTION,
      };
      const move = slide ? track(animate(fadeEl, { x: [0, `${dx}px`] }, opts)) : null;
      const fade = track(animate(fadeEl, { opacity: [1, 0] }, opts));
      const last = move ?? fade; // 有位移时位移与渐隐同时长、等它走完；无位移（减动效）等渐隐
      last.finished
        .then(() => {
          fadeEl.remove();
          tocClone = null;
          // 先退场再入场：退场播完才启动新目录的落位等待 + 右缘滑入（通常落位已
          // 到达、下一帧即播）。若退场被 cancel（快速连切，captureOld 已清落位等待
          // 与动画），这里走 catch、入场不启动——钉不可见的新目录随本轮 DOM 交换被
          // 换走，不残留
          startTocEntryWait(newToc, playEntry);
        })
        .catch(() => {});
    }
  }

  // ================= 6. 事件与初始化 =================

  // window.swup 在实例赋值前会被 DOM id 回退解析成 <main id="swup"> 元素（truthy），
  // !!window.swup 判不出就绪，必须按实例自身特征甄别
  interface SwupLike {
    hooks: { on: (name: string, handler: () => void) => void };
    navigate: (url: string) => void;
  }
  function realSwup(): SwupLike | null {
    const s = (window as Window & { swup?: unknown }).swup;
    if (!s || typeof s !== 'object') return null;
    const sw = s as Partial<SwupLike>;
    return sw.hooks && typeof sw.navigate === 'function' ? (s as SwupLike) : null;
  }

  // swup 实例钩子：区分「真实导航在途」与「swup 忽略了这次点击」。
  // @swup/astro 只在 document 上桥接 astro:before-swap / after-swap / page-load 三个事件，
  // 覆盖不了这两个状态，所以用 astro.config.ts globalInstance: true 暴露的 window.swup
  //（swup 在 onIdleAfterLoad 才初始化，实例可能晚于本模块——钩子按需在首次点击时绑）。
  // 用途：点击触发的搜索退场后，恢复定时器在「导航在途」时不得触发——dev 首次 fetch
  // 可超 1.2s，提前恢复 = 搜索框在切换中途弹回、内容落地又得二次退场（用户看到的
  // 「初次切到文章搜索框渐显」）；fetch 失败（404 / 中断）时在失败回调里恢复。
  let navInFlight = false;
  let swupHooksBound = false;
  // 首屏实例未就绪时点区内链接：拦截原生全页跳转，等实例就绪后 navigate() 转正场，
  // 超时回退原生跳转（保持 pending 到 before-swap，覆盖 fetch 在途的恢复定时器窗口）
  let pendingEarlyNav: { url: string; timer: number } | null = null;
  // 实例在 load+idle 才创建：慢网/冷缓存下 load 可超 5s（首载场景），时限要覆盖它
  const EARLY_NAV_TIMEOUT_MS = 10000;

  function bindSwupHooks(): void {
    if (swupHooksBound) return;
    const swup = realSwup();
    if (!swup) return; // 实例未就绪（取到的是 <main> 元素回退）——不打污染标记，下次点击再绑
    swupHooksBound = true;
    swup.hooks.on('visit:start', () => {
      navInFlight = true;
    });
    swup.hooks.on('content:replace', () => {
      navInFlight = false;
    });
    const restoreAfterFail = () => {
      navInFlight = false;
      pendingEarlyNav = null; // 导航已失败：早期等待随之作废，走原生兜底结果
      // 只在「仍停在列表系界面」时恢复——失败后内容未换，若此刻在详情页，
      // 搜索不该出现
      if (floatCtl.state !== 'shown' && row()?.classList.contains('page-main--listing'))
        floatCtl.settle(true);
    };
    swup.hooks.on('fetch:error', restoreAfterFail);
    swup.hooks.on('visit:abort', restoreAfterFail);
  }

  /** 首屏实例未就绪时点区内链接：swup 点击委托还没挂载，原生跳转 = 整页加载，
   *  落地首屏不播转场（用户所见「首次访问没预加载好就点卡片、动效不播」）。
   *  拦截点击、等实例就绪后 navigate() 转成正常切页——转场照常播；
   *  超时回退原生跳转（整页加载，与现状一致）。跨区目的地本就无转场，不拦截 */
  function onEarlyClick(e: MouseEvent): void {
    if (REDUCE_MOTION || realSwup()) return; // 实例已就绪：swup 自己的委托接管
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest('a[href]');
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('/posts/') || a.target === '_blank') return;
    if (a.hasAttribute('data-no-swup') || t.closest('[data-no-swup]')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const r = row();
    if (
      !r ||
      (!r.classList.contains('page-main--listing') && !r.classList.contains('page-main--post'))
    )
      return;
    if (href.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '')) return; // 同页
    e.preventDefault();
    if (pendingEarlyNav) window.clearTimeout(pendingEarlyNav.timer);
    const started = Date.now();
    const poll = (): void => {
      const s = realSwup();
      if (s) {
        // 保持 pendingEarlyNav 到 captureOld（before-swap）：fetch 在途期间压制搜索恢复定时器
        try {
          s.navigate(href);
        } catch {
          pendingEarlyNav = null;
          location.assign(href);
        }
        return;
      }
      if (Date.now() - started > EARLY_NAV_TIMEOUT_MS) {
        pendingEarlyNav = null;
        location.assign(href);
        return;
      }
      pendingEarlyNav = { url: href, timer: window.setTimeout(poll, 100) };
    };
    pendingEarlyNav = { url: href, timer: window.setTimeout(poll, 100) };
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
      if (
        floatCtl.state !== 'shown' &&
        !navInFlight &&
        !pendingEarlyNav &&
        row()?.classList.contains('page-main--listing')
      )
        floatCtl.settle(true);
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
  document.addEventListener('click', onEarlyClick);
  document.addEventListener('click', onDocClick);
  document.addEventListener('astro:before-swap', captureOld);
  document.addEventListener('astro:after-swap', () => onReady(true));
  onReady();
})();

// 标记为模块：文件顶层有 import，TS 模块检查要求显式模块语义
export {};
