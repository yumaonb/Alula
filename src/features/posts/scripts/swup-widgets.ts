// swup-widgets.ts — 文章侧边按钮的可用性探测与评论跳转
// 用法：由 PostsExtras 引入：import '../scripts/swup-widgets'
import '../../../assets/js/nav/page-widgets';
import { detectPageKind } from '../../../assets/js/util/page-kind';
import { queryTocNav } from '../../../assets/js/util/post-sidebar';

const controller = new AbortController();
const { signal } = controller;
let resizeRafId = 0;

function probe(): void {
  const container = document.getElementById('side-widgets');
  if (!container) return;

  const { detail, list } = detectPageKind();
  // 目录条目口径与 src/features/posts/layouts/PostsShell.astro 的 hasToc 契约对应。
  const hasToc = !!queryTocNav()?.querySelector('.toc-link');
  const hasComments = !!document.getElementById('comments-section');
  const width = window.innerWidth;
  const tocButton = container.querySelector('[data-widget="toc"]');
  const filterButton = container.querySelector('[data-widget="filter"]');
  const commentsButton = container.querySelector('[data-widget="comments"]');

  // 目录栏在 ≤850 隐藏，与 src/features/posts/layouts/PostsShell.astro、src/features/posts/scripts/toc.ts 两处同改。
  tocButton?.classList.toggle('unavailable', !(hasToc && width <= 850));
  commentsButton?.classList.toggle('unavailable', !hasComments);
  // 筛选阈值与 src/features/posts/styles/shell.css 的侧栏显隐同改；768/769 见 breakpoint.ts。
  const hasFilter = detail ? width <= 1150 : list && width <= 768;
  filterButton?.classList.toggle('unavailable', !hasFilter);
  filterButton?.classList.toggle('compact', !detail && list && width <= 768);

  // 探测后同帧刷新显隐；事件名与 page-widgets.ts 两处同改。
  document.dispatchEvent(new Event('page-widgets:refresh'));
}

function onResize(): void {
  if (resizeRafId) return;
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0;
    probe();
  });
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  const element =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const button = element?.closest<HTMLElement>('#side-widgets .back-to-widget');
  if (button?.dataset.widget !== 'comments' || button.classList.contains('unavailable')) return;
  document
    .getElementById('comments-section')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onPageHide(event: PageTransitionEvent): void {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = 0;
  // 往返缓存恢复时仍需重新探测按钮。
  if (!event.persisted) controller.abort();
}

document.addEventListener('click', onClick, { signal });
document.addEventListener('swup:content:replace', probe, { signal });
window.addEventListener('resize', onResize, { signal });
window.addEventListener('pageshow', probe, { signal });
window.addEventListener('pagehide', onPageHide, { signal });
probe();
