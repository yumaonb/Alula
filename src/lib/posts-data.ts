// posts-data.ts — 文章数据统一入口
//
// 全站所有页面/侧栏共用这一个模块读取文章与分类：
//   - 基于 astro:content 的 getCollection('posts')（schema 校验生效）
//   - 分类只由目录结构决定；分类元数据只读各目录下的 index.json（解析一次）
//   - 结果按模块级缓存，避免每个页面各自重复 import.meta.glob 全量 md
//
// 只能在服务端（页面/Astro 组件 frontmatter）使用，禁止客户端引用。
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  buildCategoryTree,
  formatDate,
  postRoute,
  type BreadcrumbItem,
  type CategoryMeta,
  type CategoryTreeNode,
  type PostItem,
} from './category';
import { commentCountFor, loadCommentCounts } from './comment-counts';

/** 内容根目录（相对项目根，与 posts 集合目录一致） */
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

/** 构建分类元数据字典（只读 index.json，其余配置文件一律不解析） */
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
  /** 分类元数据（目录路径 → 配置） */
  meta: Record<string, CategoryMeta>;
  /** 全部文章（置顶优先 + 日期倒序） */
  posts: PostItem[];
  /** 全量 collection entries（文章详情页渲染用，按 id 查） */
  entries: PostEntry[];
  /** 分类树（侧栏用） */
  categoryTree: CategoryTreeNode[];
  /** 标签计数（侧栏用，按数量倒序、名称升序） */
  tags: { name: string; count: number }[];
}

let cache: Promise<BlogData> | null = null;

/**
 * 粗略统计 markdown 正文的字数：中文字符 + 英文单词。
 * 去掉代码块、行内代码与图片，尽量贴近实际阅读量。
 */
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
      const parts = e.id.split('/');
      // 分类 = 文件所在目录（content/posts 之内的路径）
      const category = parts.slice(0, -1).join('/');
      const url = `/${[postRoute, ...parts].join('/')}/`;
      const words = countWords(e.body || '');
      return {
        slug: e.id,
        title: d.title ?? '无标题',
        date: d.date ? formatDate(d.date) : '',
        description: typeof d.description === 'string' ? d.description : '',
        image: typeof d.image === 'string' ? d.image : '',
        tags: Array.isArray(d.tags) ? d.tags : [],
        pinned: d.pinned === true,
        category,
        categoryDisplayName: category
          ? meta[category]?.name || parts[parts.length - 2]
          : '',
        categoryUrl: category ? `/${[postRoute, ...category.split('/')].join('/')}/` : '',
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

/**
 * 全站唯一数据入口。模块级缓存：同一次构建/请求内各页面共用一份结果。
 */
export async function loadBlogData(): Promise<BlogData> {
  cache ??= buildData();
  return cache;
}

/**
 * 文章详情页渲染：返回渲染结果（Content / headings）
 */
export async function renderPost(entry: PostEntry) {
  return entry.render();
}

/**
 * 为一篇 PostItem 构建面包屑
 */
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
