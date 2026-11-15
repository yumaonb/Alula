// posts-data.ts — 文章数据统一入口（各页面 / 侧栏共用，仅服务端）：读集合 + 分类元数据，视图口径在 posts-views.ts
// 用法：import { loadBlogData, renderPost, postBreadcrumbs } from "../../lib/posts-data"
// 数据结构：{ meta, ...views, entries }，见 BlogData；模块级缓存。
import { getCollection, render, type CollectionEntry } from 'astro:content';
import {
  buildCategoryTrail,
  type BreadcrumbItem,
  type CategoryMeta,
  postRoute,
  type PostItem,
} from './category';
import { buildPostViews, type PostViews } from './posts-views';

const contentRoot = 'content/posts';

/* ---- 分类元数据 ---- */
function metaKeyOf(fileKey: string): string | null {
  const key = fileKey.replace(/\\/g, '/');
  const marker = `/${contentRoot}/`;
  const idx = key.indexOf(marker);
  if (idx < 0) return null;
  const rel = key.slice(idx + marker.length).replace(/\/index\.json$/, '');
  return rel || null;
}

const metaJson = import.meta.glob<{ default?: { name?: unknown; description?: unknown } }>(
  '../content/posts/**/index.json',
  { eager: true },
);

export function buildCategoryMeta(): Record<string, CategoryMeta> {
  const meta: Record<string, CategoryMeta> = {};
  for (const [fp, m] of Object.entries(metaJson)) {
    const key = metaKeyOf(fp);
    if (!key) continue;
    const raw = m.default;
    if (!raw || typeof raw !== 'object') continue;
    meta[key] = {
      name: typeof raw.name === 'string' ? raw.name : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
    };
  }
  return meta;
}

/* ---- 文章数据 ---- */
export type PostEntry = CollectionEntry<'posts'>;

export interface BlogData extends PostViews {
  // 分类元数据：目录路径 → 配置
  meta: Record<string, CategoryMeta>;
  // 全量条目，供文章详情页渲染
  entries: PostEntry[];
}

let cache: Promise<BlogData> | null = null;

async function buildData(): Promise<BlogData> {
  const entries = await getCollection('posts');
  const meta = buildCategoryMeta();
  return { meta, ...buildPostViews(entries, meta), entries };
}

export async function loadBlogData(): Promise<BlogData> {
  if (!cache) {
    const pending = buildData();
    cache = pending;
    // 失败的那次不能留在缓存里：缓存的是 Promise，rejected 的 Promise 会被永久复用，
    // 之后每次调用都拿到同一个错误、再也重试不了（dev 里表现为「一直报错、刷新也不好了」）
    pending.catch(() => {
      if (cache === pending) cache = null;
    });
  }
  return cache;
}

export async function renderPost(entry: PostEntry) {
  return render(entry);
}

export function postBreadcrumbs(
  post: PostItem,
  meta: Record<string, CategoryMeta>,
): BreadcrumbItem[] {
  return [
    { label: '文章首页', href: `/${postRoute}/`, icon: 'la:home' },
    ...buildCategoryTrail(post.category, meta).map((item) => ({
      label: item.name,
      href: item.url,
    })),
    { label: post.title },
  ];
}
