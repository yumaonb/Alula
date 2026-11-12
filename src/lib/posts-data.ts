// posts-data.ts — 文章数据统一入口（各页面 / 侧栏共用，仅服务端）
// 用法：import { loadBlogData, renderPost, postBreadcrumbs } from "../../lib/posts-data"
// 数据结构：{ meta, posts, allPosts, chronological, entries, categoryTree, tags, allTags }，见 BlogData；模块级缓存。
import { getCollection, render, type CollectionEntry } from 'astro:content';
import {
  buildCategoryTrail,
  buildCategoryTree,
  formatDate,
  postRoute,
  visiblePosts,
  type BreadcrumbItem,
  type CategoryMeta,
  type CategoryTreeNode,
  type PostItem,
} from './category';

const contentRoot = 'content/posts';

/** 日期 → 可比较的时间戳。没有日期的按 0 算（排最后） */
function dateValue(date: string): number {
  return date ? new Date(date).getTime() : 0;
}

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

export interface BlogData {
  // 分类元数据：目录路径 → 配置
  meta: Record<string, CategoryMeta>;
  // 可列出的文章（隐藏文章已排除）：置顶优先、日期倒序
  posts: PostItem[];
  // 全部文章（含隐藏）：仅供文章页生成路由与取用，不要直接列表渲染
  allPosts: PostItem[];
  // 全量条目，供文章详情页渲染
  entries: PostEntry[];
  // 侧栏分类树（只统计可列出的文章）
  categoryTree: CategoryTreeNode[];
  // 侧栏标签计数（只统计可列出的文章）：数量倒序
  tags: { name: string; count: number }[];
  // 纯按日期倒序的视图（不看置顶）：上下篇、订阅源「最后更新」用这个，
  // 置顶文章不改变「谁比谁新」
  chronological: PostItem[];
  // 标签并集（含隐藏文章的标签）：只为生成路由——隐藏文章的页头有标签链接，
  // 路由缺了那一条就是 404
  allTags: string[];
}

let cache: Promise<BlogData> | null = null;

function countWords(body: string): number {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  const cjk = (cleaned.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g) || []).length;
  const latin = (
    cleaned.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, ' ').match(/[A-Za-z0-9]+/g) || []
  ).length;
  return cjk + latin;
}

async function buildData(): Promise<BlogData> {
  const entries = await getCollection('posts');
  const meta = buildCategoryMeta();

  const allPosts: PostItem[] = entries
    .map((e) => {
      const d = e.data;
      const parts = e.id.split('/');
      // 分类 = 文件所在目录（content/posts 之内的路径）
      const category = parts.slice(0, -1).join('/');
      const url = `/${[postRoute, ...parts].join('/')}/`;
      const words = countWords(e.body || '');
      // 缺字段默认值：content.config.ts 的 transform 里各写一份，改默认值两处同改
      return {
        slug: e.id,
        title: d.title ?? '无标题',
        date: d.date ? formatDate(d.date) : '',
        description: typeof d.description === 'string' ? d.description : '',
        image: typeof d.image === 'string' ? d.image : '',
        tags: Array.isArray(d.tags) ? d.tags : [],
        pinned: d.pinned === true,
        hidden: d.hidden === true,
        category,
        categoryTrail: category ? buildCategoryTrail(category, meta) : [],
        basePath: category ? `${contentRoot}/${category}` : contentRoot,
        url,
        words,
      } satisfies PostItem;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return dateValue(b.date) - dateValue(a.date);
    });

  // 列表口径：隐藏文章只保留「能生成页面」，其余派生数据（分类树 / 标签云 / 上下篇）都不带它
  const posts = visiblePosts(allPosts);

  const categoryTree = buildCategoryTree(posts, meta);

  const tagCounts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.tags) {
      // 标签名会直接进 URL 路径段：含 / 时编码成 %2F 与静态路由对不上，
      // 产物是多级目录、点进去 404。在构建期炸掉，别让它变成坏链接
      if (t.includes('/')) {
        throw new Error(`文章「${p.slug}」的标签 "${t}" 含斜杠，标签名不能包含 /`);
      }
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));

  // 上下篇与「最后更新」只看日期：用 posts 的下标会因置顶把新旧关系翻转
  const chronological = [...posts].sort((a, b) => dateValue(b.date) - dateValue(a.date));

  // 标签路由的并集口径与分类路由一致（分类那边同样用 allPosts 建路由）
  const allTags = [...new Set(allPosts.flatMap((p) => p.tags))].sort((a, b) =>
    a.localeCompare(b, 'zh'),
  );

  return { meta, posts, allPosts, entries, categoryTree, tags, chronological, allTags };
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
