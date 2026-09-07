// category.ts — 分类逻辑（纯函数 + 类型）
//
// 文章数据接入统一走 src/lib/posts-data.ts（基于 astro:content 的 getCollection），
// 本文件只保留与 astro 运行环境无关的纯工具与类型，方便复用。
//
// 分类语义（唯一形式）：
//   文章的分类 = 文章在 src/content/posts/ 下的目录路径（目录结构即分类）。
//   不做其他博客格式的适配：frontmatter 里的 categories/category/分类 一律忽略，
//   分类显示名由目录下的 index.json 提供（没有则直接用目录名）。

/** 分类路由前缀（对应 src/pages/posts 目录），URL 形如 /posts/{slug}/ */
export const postRoute = 'posts';

// ---- 类型 ----

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

/** 文章列表项 */
export interface PostItem {
  slug: string;
  title: string;
  /** 已格式化的日期 YYYY-MM-DD（无日期时为空串） */
  date: string;
  description: string;
  /** 封面图（原样保留 frontmatter 相对路径） */
  image: string;
  tags: string[];
  pinned: boolean;
  /** 所属分类 = 文章目录路径（content/posts 之内），如 "devnotes/css"；文章直接在根目录则为空串 */
  category: string;
  /** 完整分类链（每级分类名 + 对应分类页 URL；无分类时为空数组） */
  categoryTrail: CategoryTrailItem[];
  /** 评论数（构建期由 giscus 数据而来；拉取失败时为 undefined，卡片隐藏评论数） */
  commentCount?: number;
  /** 图片基准目录（相对 src/），供 ImageWrapper 解析相对图片 */
  basePath: string;
  /** 文章完整 URL，如 /posts/devnotes/css/at-rule/ */
  url: string;
  /** 估算字数（中文字符数 + 英文单词数，粗略，不含代码块） */
  words: number;
}

/** 面包屑项 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string; // astro-icon name，如 "la:home"
}

// ---- 工具 ----

/**
 * 格式化日期为 YYYY-MM-DD（无有效日期返回空串）
 */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!d || isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 文章是否属于某个分类（目标分类是文章分类的祖先或自身）
 */
export function postMatchesCategory(post: PostItem, target: string): boolean {
  return !!post.category && (post.category === target || post.category.startsWith(target + '/'));
}

/**
 * 生成分类页 URL：/posts/{分类路径}/
 */
export function buildCategoryUrl(
  categoryPath: string[],
  routePrefix: string = postRoute,
): string {
  return '/' + [routePrefix, ...categoryPath].join('/') + '/';
}

/**
 * 构建文章的完整分类链：父分类 → … → 当前分类，每级带分类页 URL。
 * 无分类时返回空数组。
 */
export function buildCategoryTrail(
  category: string,
  meta: Record<string, CategoryMeta>,
  routePrefix: string = postRoute,
): CategoryTrailItem[] {
  const parts = category.split('/').filter(Boolean);
  const trail: CategoryTrailItem[] = [];
  let current: string[] = [];
  for (const seg of parts) {
    current.push(seg);
    trail.push({
      name: meta[current.join('/')]?.name || seg,
      url: buildCategoryUrl(current, routePrefix),
    });
  }
  return trail;
}

// ---- 分类树 ----

/**
 * 构建分类树（含各层级中间节点）。
 * count 为该分类及其所有子孙分类下的文章总数。
 */
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
