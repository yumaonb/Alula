// posts-views.ts — 文章视图口径（纯函数）：从集合条目派生 posts / allPosts / chronological / 分类树 / 标签
// 用法：import { buildPostViews, buildPostUrl } from "../lib/posts-views"
// 口径写错不会构建报错、只会上线后静默 404，行为测试见 tests/behavior/posts-views.test.mjs。
import {
  buildCategoryTrail,
  buildCategoryTree,
  formatDate,
  postRoute,
  visiblePosts,
  type CategoryMeta,
  type CategoryTreeNode,
  type PostItem,
} from './category.ts';

const contentRoot = 'content/posts';

/** 集合条目的最小结构：构建期真实条目（CollectionEntry）与测试夹具都按这个形状传入 */
export interface RawPostEntry {
  /** 集合条目 id = 相对 content/posts 的无扩展名路径，如 "devnotes/css/at-rule" */
  id: string;
  /** Markdown 正文（字数估算用） */
  body?: string;
  /** frontmatter：缺字段 / 类型不符都按默认值兜底，与 content.config.ts 的 transform 互为「两处同改」 */
  data: {
    title?: string;
    date?: Date | string;
    description?: string;
    image?: string;
    tags?: unknown;
    pinned?: unknown;
    hidden?: unknown;
  };
}

/** 各视图的口径（不含 meta 与原始条目，那是 posts-data.ts 组装的事） */
export interface PostViews {
  /** 可列出的文章（隐藏文章已排除）：置顶优先、日期倒序 */
  posts: PostItem[];
  /** 全部文章（含隐藏）：仅供文章页生成路由与取用，不要直接列表渲染 */
  allPosts: PostItem[];
  /** 侧栏分类树（只统计可列出的文章） */
  categoryTree: CategoryTreeNode[];
  /** 侧栏标签计数（只统计可列出的文章）：数量倒序 */
  tags: { name: string; count: number }[];
  /** 纯按日期倒序的视图（不看置顶）：上下篇、订阅源「最后更新」用这个，置顶文章不改变「谁比谁新」 */
  chronological: PostItem[];
  /** 标签并集（含隐藏文章的标签）：只为生成路由——隐藏文章的页头有标签链接，路由缺了那一条就是 404 */
  allTags: string[];
}

/** 日期 → 可比较的时间戳。没有日期的按 0 算（排最后） */
function dateValue(date: string): number {
  return date ? new Date(date).getTime() : 0;
}

/** 文章 URL：/posts/<目录段…>/<文件名>/，与路由生成共用这一份拼接 */
export function buildPostUrl(slug: string): string {
  const parts = slug.split('/');
  return `/${[postRoute, ...parts].join('/')}/`;
}

export function countWords(body: string): number {
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

export function buildPostViews(
  entries: RawPostEntry[],
  meta: Record<string, CategoryMeta>,
): PostViews {
  const allPosts: PostItem[] = entries
    .map((e) => {
      const d = e.data;
      const parts = e.id.split('/');
      // 分类 = 文件所在目录（content/posts 之内的路径）
      const category = parts.slice(0, -1).join('/');
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
        url: buildPostUrl(e.id),
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

  return { posts, allPosts, categoryTree, tags, chronological, allTags };
}
