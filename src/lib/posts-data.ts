// posts-data.ts — 文章数据统一入口（各页面/侧栏共用，仅服务端可用）
// 用法：import { loadBlogData, renderPost, postBreadcrumbs } from "../../lib/posts-data"
// 数据：{ meta, posts, entries, categoryTree, tags }，见 BlogData；模块级缓存，同一次构建共享一份。
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  buildCategoryTrail,
  buildCategoryTree,
  formatDate,
  postRoute,
  type BreadcrumbItem,
  type CategoryMeta,
  type CategoryTreeNode,
  type PostItem,
} from './category';
import { commentCountFor, loadCommentCounts } from './comment-counts';

/** 相对项目根，必须与 posts 集合目录一致 */
const contentRoot = 'content/posts';

// ---- 分类元数据 ----

/** 目录 key（相对 content/posts），如 "alula/posts/index.json" → "alula/posts" */
function metaKeyOf(fileKey: string): string | null {
  const key = fileKey.replace(/\\/g, '/');
  const marker = `/${contentRoot}/`;
  const idx = key.indexOf(marker);
  if (idx < 0) return null;
  const rel = key.slice(idx + marker.length).replace(/\/index\.json$/, '');
  return rel || null;
}

const metaJson = import.meta.glob('../content/posts/**/index.json', { eager: true });

/** 分类元数据字典，仅解析各目录的 index.json */
export function buildCategoryMeta(): Record<string, CategoryMeta> {
  const meta: Record<string, CategoryMeta> = {};
  for (const [fp, m] of Object.entries(metaJson)) {
    const key = metaKeyOf(fp);
    if (!key) continue;
    const raw = (m as any)?.default ?? m;
    if (!raw || typeof raw !== 'object') continue;
    meta[key] = {
      name: typeof raw.name === 'string' ? raw.name : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
    };
  }
  return meta;
}

// ---- 文章数据 ----

export type PostEntry = CollectionEntry<'posts'>;

export interface BlogData {
  meta: Record<string, CategoryMeta>; // 分类元数据：目录路径 → 配置
  posts: PostItem[]; // 全部文章：置顶优先、日期倒序
  entries: PostEntry[]; // 全量条目，供文章详情页渲染
  categoryTree: CategoryTreeNode[]; // 侧栏分类树
  tags: { name: string; count: number }[]; // 侧栏标签计数：数量倒序
}

let cache: Promise<BlogData> | null = null;

/** 统计正文字数：中文字符 + 英文单词，剔除代码块与图片 */
function countWords(body: string): number {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  const cjk = (cleaned.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g) || []).length;
  const latin = (cleaned.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + latin;
}

async function buildData(): Promise<BlogData> {
  const entries = await getCollection('posts');
  const meta = buildCategoryMeta();
  // 构建期拉取一次 giscus 评论数；失败为 null（所有卡片隐藏评论数）
  const commentCounts = await loadCommentCounts();

  const posts: PostItem[] = entries
    .map((e) => {
      const d = e.data as any;
      const parts = e.slug.split('/');
      // 分类 = 文件所在目录（content/posts 之内的路径）
      const category = parts.slice(0, -1).join('/');
      const url = `/${[postRoute, ...parts].join('/')}/`;
      const words = countWords(e.body || '');
      return {
        slug: e.slug,
        title: d.title ?? '无标题',
        date: d.date ? formatDate(d.date) : '',
        description: typeof d.description === 'string' ? d.description : '',
        image: typeof d.image === 'string' ? d.image : '',
        tags: Array.isArray(d.tags) ? d.tags : [],
        pinned: d.pinned === true,
        category,
        categoryTrail: category ? buildCategoryTrail(category, meta) : [],
        commentCount: commentCountFor(commentCounts, url),
        basePath: category ? `${contentRoot}/${category}` : contentRoot,
        url,
        words,
      } satisfies PostItem;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const t = (d: string) => (d ? new Date(d).getTime() : 0);
      return t(b.date) - t(a.date);
    });

  const categoryTree = buildCategoryTree(posts, meta);

  const tagCounts = new Map<string, number>();
  for (const p of posts) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));

  return { meta, posts, entries, categoryTree, tags };
}

/** 全站唯一数据入口，模块级缓存，各页面共用一份结果 */
export async function loadBlogData(): Promise<BlogData> {
  cache ??= buildData();
  return cache;
}

/** 渲染文章，返回 Content 组件与 headings */
export async function renderPost(entry: PostEntry) {
  return entry.render();
}

export function postBreadcrumbs(
  post: PostItem,
  meta: Record<string, CategoryMeta>,
): BreadcrumbItem[] {
  const catPath = post.category ? post.category.split('/') : [];
  const items: BreadcrumbItem[] = [{ label: '文章首页', href: `/${postRoute}/`, icon: 'la:home' }];
  let current: string[] = [];
  for (const seg of catPath) {
    current.push(seg);
    items.push({
      label: meta[current.join('/')]?.name || seg,
      href: `/${[postRoute, ...current].join('/')}/`,
    });
  }
  items.push({ label: post.title });
  return items;
}
