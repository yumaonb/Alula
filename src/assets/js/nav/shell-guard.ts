// shell-guard.ts — 阻止 swup 跨外壳替换内容（站点页 ↔ 后台页）
// 用法：由 BaseLayout.astro 引入：import '../assets/js/nav/shell-guard'
//
// 站点页与后台页的外壳不同，而 swup 注入在所有页面上、只替换 #swup 里的内容，
// 于是「后台 → 回到站点 → 浏览器后退」这类路径会把站点内容塞进后台外壳（反之亦然）。
// swup 的 ignoreVisit 只作用于点击、不作用于前进/后退，所以这里自己兜住：
// 一旦发现「当前外壳」与「目标 URL」对不上，就交给浏览器整页加载。

(() => {
  if (window.__alulaShellGuard) return;
  window.__alulaShellGuard = true;

  // 外壳身份读 data-shell 属性，不靠裸 id：id 可能被别人复用（同名的站点元素
  // 会让守卫误判，站点↔后台切换每次都变成整页刷新）
  const isAdminShell = (): boolean => document.querySelector('[data-shell="admin"]') !== null;

  const isAdminUrl = (url: string): boolean => {
    const { pathname } = new URL(url, window.location.origin);
    return pathname === '/admin' || pathname.startsWith('/admin/');
  };

  /** 当前外壳与目标地址对不上：该整页加载，而不是让 swup 换内容 */
  const mismatched = (url?: string): boolean =>
    isAdminShell() !== isAdminUrl(url ?? window.location.href);

  window.addEventListener('popstate', (e) => {
    const target = e.state?.url ?? window.location.href;
    if (!mismatched(target)) return;
    // swup 的初始化延到 idle，通常排在这个模块之后，掐掉它这次处理
    e.stopImmediatePropagation();
    window.location.reload();
  });

  // 兜底：万一 swup 已经换过内容（顺序不巧），刷新回正确的外壳
  document.addEventListener('swup:content:replace', () => {
    if (mismatched()) window.location.reload();
  });
})();
