// post-listing.ts — 文章搜索逻辑（基于 Pagefind，搜索框下拉浮层展示结果）
// 每个搜索框创建独立的 SearchController 实例，swup 切页后旧实例随 DOM 销毁，新页面重新创建。

interface PagefindData { url: string; excerpt: string; meta?: { title?: string } }

let pagefindPromise: Promise<any> | null = null;
function loadPagefind(): Promise<any> {
  if (!pagefindPromise) {
    const u = '/pagefind/pagefind.js';
    pagefindPromise = import(/* @vite-ignore */ u)
      .then(m => { m.options?.({ excerptLength: 20 }); return m; })
      .catch(e => { console.error('[post-listing] Pagefind load failed', e); pagefindPromise = null; throw e; });
  }
  return pagefindPromise;
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}

class SearchController {
  private kw = '';
  private data: PagefindData[] = [];
  private seq = 0;
  private ai = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private el: HTMLInputElement;
  private dd: HTMLElement;
  constructor(el: HTMLInputElement, dd: HTMLElement) {
    this.el = el; this.dd = dd;
    this.el.addEventListener('input', this.onInput);
    this.el.addEventListener('focus', this.onFocus);
    this.el.addEventListener('keydown', this.onKey);
    this.dd.addEventListener('mouseover', this.onOver);
    document.addEventListener('click', this.onOutside);
  }
  destroy() {
    this.el.removeEventListener('input', this.onInput);
    this.el.removeEventListener('focus', this.onFocus);
    this.el.removeEventListener('keydown', this.onKey);
    this.dd.removeEventListener('mouseover', this.onOver);
    document.removeEventListener('click', this.onOutside);
    if (this.timer) clearTimeout(this.timer);
  }
  private onInput = () => {
    this.kw = this.el.value.trim(); this.ai = -1;
    if (this.timer) clearTimeout(this.timer);
    if (!this.kw) { this.data = []; this.close(); return; }
    this.timer = setTimeout(() => void this.search(), 200);
  };
  private onFocus = () => { void loadPagefind().catch(() => {}); if (this.kw) this.open(); };
  private onKey = (e: KeyboardEvent) => {
    const n = this.dd.querySelectorAll('.psd-item').length;
    if (e.key === 'ArrowDown' && n > 0) { e.preventDefault(); this.setAi(this.ai + 1); }
    else if (e.key === 'ArrowUp' && n > 0) { e.preventDefault(); this.setAi(this.ai - 1); }
    else if (e.key === 'Enter' && this.ai >= 0) {
      const a = this.dd.querySelectorAll('.psd-item')[this.ai] as HTMLAnchorElement | undefined;
      if (a) { e.preventDefault(); a.click(); }
    }
  };
  private onOver = (e: Event) => {
    const it = (e.target as HTMLElement).closest?.('.psd-item') as HTMLElement | null;
    if (it) this.setAi(Number(it.dataset.index));
  };
  private onOutside = (e: Event) => {
    const t = e.target as HTMLElement;
    if (t.closest('#post-search-box') || t.closest('#post-search-dropdown')) return;
    if (!this.dd.hidden) this.close();
  };
  private async search() {
    const s = ++this.seq;
    if (!this.kw) { this.data = []; this.close(); return; }
    this.dd.hidden = false;
    this.dd.innerHTML = '<div class="psd-empty">搜索中…</div>';
    try {
      const pf = await loadPagefind();
      const res = await pf.search(this.kw);
      const loaded = await Promise.all(res.results.map((r: any) => r.data()));
      if (s !== this.seq) return;
      this.data = loaded;
    } catch {
      if (s !== this.seq) return;
      this.dd.innerHTML = '<div class="psd-empty">搜索索引不可用（请先构建站点）</div>';
      return;
    }
    this.ai = -1; this.render();
  }
  private render() {
    if (!this.data.length) {
      this.dd.innerHTML = '<div class="psd-empty">没有找到与「' + esc(this.kw) + '」相关的文章</div>';
      return;
    }
    this.dd.innerHTML = this.data.map((it, i) => {
      const t = it.meta?.title || decodeURIComponent(it.url.replace(/\/$/, '').split('/').pop() || it.url);
      return '<a class="psd-item' + (i === this.ai ? ' psd-item--active' : '') + '" href="' + esc(it.url) + '" data-index="' + i + '"><span class="psd-item-title">' + esc(t) + '</span><span class="psd-item-excerpt">' + it.excerpt + '</span></a>';
    }).join('');
    this.dd.scrollTop = 0;
  }
  private setAi(i: number) {
    const items = this.dd.querySelectorAll('.psd-item');
    if (!items.length) return;
    this.ai = Math.max(0, Math.min(i, items.length - 1));
    items.forEach((el, j) => el.classList.toggle('psd-item--active', j === this.ai));
    items[this.ai].scrollIntoView({ block: 'nearest' });
  }
  private open() { if (this.kw) this.dd.hidden = false; }
  private close() { this.dd.hidden = true; this.ai = -1; }
}

function initSearch() {
  const input = document.getElementById('post-search') as HTMLInputElement | null;
  const dd = document.getElementById('post-search-dropdown');
  if (!input || !dd) return;
  // swup 切页后新 #post-search 没有 __sc，需要重建
  const prev = (input as any).__sc as SearchController | undefined;
  if (prev) { prev.destroy(); }
  (input as any).__sc = new SearchController(input, dd);
}
initSearch();

// 暴露给 PostSearch.astro 的 is:inline 脚本（备用）
(window as any).__initPostSearch = initSearch;

// swup 切页后重新绑定搜索：BaseLayout 每页都加载本模块，listener 持久有效
document.addEventListener('swup:content:replace', () => {
  initSearch();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== '/') return;
  const t = e.target as HTMLElement;
  if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
  const input = document.getElementById('post-search');
  if (input) { e.preventDefault(); input.focus(); }
});
