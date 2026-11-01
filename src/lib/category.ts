// category.ts — 分类逻辑（纯函数 + 类型）：目录结构即分类，分类名由 index.json 提供
// 用法：import { postRoute, buildCategoryUrl, buildCategoryTree, ... } from "../../lib/category"
// 数据接入见 lib/posts-data.ts；frontmatter 中 categories/category/分类 字段一律忽略。

/** 分类路由前缀（对应 src/pages/posts 目录），URL 形如 /posts/{slug}/ */
export const postRoute = 'posts';

/* ---- 类型 ---- */
/** 分类元数据（来自各分类目录下的 index.json） */
export interface CategoryMeta {
  /** 分类显示名（不填则用目录名） */
  name?: string;
  /** 分类描述 */
  description?: string;
}

/** 分类树节点（含各层级中间节点） */
export interface CategoryTreeNode {
  /** 完整目录路径，如 "devnotes/css" */
  path: string;
  /** 显示名称（有 index.json 用 name，否则用最后一段目录名） */
  name: string;
  /** 子树内的文章总数 */
  count: number;
  children: CategoryTreeNode[];
}

/** 分类链节点（文章所属分类的一级一级路径，如 开发速查 → CSS） */
export interface CategoryTrailItem {
  /** 该级分类显示名（有 index.json 用 name，否则用目录名） */
  name: string;
  /** 该级分类页 URL，如 /posts/devnotes/css/ */
  url: string;
}

export interface PostItem {
  /** 文章标识 = 集合条目 id（相对 content/posts 的无扩展名路径），同时用作路由参数 */
  slug: string;
  title: string;
  /** 已格式化的日期 YYYY-MM-DD（无日期时为空串） */
  date: string;
  description: string;
  /** 封面图（原样保留 frontmatter 相对路径） */
  image: string;
  tags: string[];
  pinned: boolean;
  /** 隐藏文章：不进列表/分类/标签/订阅源/搜索，也不出现在别处的上下篇里，只能靠直链访问 */
  hidden: boolean;
  /** 所属分类 = 文章目录路径（content/posts 之内），如 "devnotes/css"；文章直接在根目录则为空串 */
  category: string;
  /** 完整分类链（每级分类名 + 对应分类页 URL；无分类时为空数组） */
  categoryTrail: CategoryTrailItem[];
  /** 图片基准目录（相对 src/），供 ImageWrapper 解析相对图片 */
  basePath: string;
  /** 文章完整 URL，如 /posts/devnotes/css/at-rule/ */
  url: string;
  /** 估算字数（中文字符数 + 英文单词数，粗略，不含代码块） */
  words: number;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  // astro-icon name，如 "la:home"
  icon?: string;
}

/* ---- 工具 ---- */
/** 日期统一输出 YYYY-MM-DD：按 UTC 取值，构建机时区再靠西也不会把日期挪前一天 */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!d || isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function postMatchesCategory(post: PostItem, target: string): boolean {
  return !!post.category && (post.category === target || post.category.startsWith(target + '/'));
}

/** 可见文章：隐藏文章不进列表、分类页、标签页、订阅源、上下篇，只能靠直链访问 */
export function visiblePosts(posts: PostItem[]): PostItem[] {
  return posts.filter((post) => !post.hidden);
}

export function buildCategoryUrl(categoryPath: string[]): string {
  return '/' + [postRoute, ...categoryPath].join('/') + '/';
}

/** 标签页 URL。标签里可能有空格 / 中文 / `#`，必须编码，否则链接与构建出的静态路径对不上 */
export function buildTagUrl(tag: string): string {
  return `/${postRoute}/tag/${encodeURIComponent(tag)}/`;
}

/* ---- 从 URL 反查当前分类 / 标签（构建期首屏与客户端切页共用这一份） ---- */

/** 解码单个路径段。畸形编码（孤立的 `%`）原样返回，不让一个坏链接把整个侧栏搞崩 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** 取出 URL 里文章区之后的部分；不在文章区下时返回空数组 */
export function postPathSegments(pathname: string): string[] {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const at = segments.indexOf(postRoute);
  return at >= 0 ? segments.slice(at + 1) : [];
}

/** 在已知分类路径里找 URL 对应的最长前缀，即「当前所在分类」；找不到返回空串 */
export function activeCategoryOf(segments: string[], known: Set<string>): string {
  for (let i = segments.length; i > 0; i--) {
    const candidate = decodeSegment(segments.slice(0, i).join('/'));
    if (known.has(candidate)) return candidate;
  }
  return '';
}

/** 标签页 `/posts/tag/<tag>/` 里的标签名；不是标签页返回空串 */
export function activeTagOf(segments: string[]): string {
  return segments[0] === 'tag' && segments.length === 2 ? decodeSegment(segments[1]) : '';
}

export function buildCategoryTrail(
  category: string,
  meta: Record<string, CategoryMeta>,
): CategoryTrailItem[] {
  const parts = category.split('/').filter(Boolean);
  const trail: CategoryTrailItem[] = [];
  let current: string[] = [];
  for (const seg of parts) {
    current.push(seg);
    trail.push({
      name: meta[current.join('/')]?.name || seg,
      url: buildCategoryUrl(current),
    });
  }
  return trail;
}

/* ---- 分类树 ---- */
export function buildCategoryTree(
  posts: PostItem[],
  categoryMeta: Record<string, CategoryMeta>,
): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();

  const ensure = (path: string): CategoryTreeNode => {
    let node = nodes.get(path);
    if (node) return node;
    const parts = path.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    node = { path, name: '', count: 0, children: [] };
    nodes.set(path, node);
    if (parentPath) ensure(parentPath).children.push(node);
    return node;
  };

  for (const post of posts) {
    if (!post.category) continue;
    const parts = post.category.split('/');
    for (let i = 1; i <= parts.length; i++) ensure(parts.slice(0, i).join('/'));
    ensure(post.category).count += 1;
  }

  for (const [path, node] of nodes) {
    const last = path.split('/').pop() || path;
    node.name = categoryMeta[path]?.name || last;
  }

  const finalize = (node: CategoryTreeNode): void => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    for (const child of node.children) {
      finalize(child);
      node.count += child.count;
    }
  };

  const roots = [...nodes.values()].filter((n) => !n.path.includes('/'));
  roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
  for (const root of roots) finalize(root);
  return roots;
}
