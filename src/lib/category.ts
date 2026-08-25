// category.ts - 分类逻辑模块
//
// 将目录结构分类的判断、元数据加载、面包屑构建等逻辑集中管理。
// 后续适配多种分类方式时只需新增策略，不需要改动页面组件。

// ========== 类型定义 ==========

/** 文章模块（Astro import.meta.glob 的结果） */
export interface PostModule {
  frontmatter: {
    title: string;
    date: string;
    description?: string;
    image?: string;
    tags?: string[];
    pinned?: boolean;
  };
  compiledContent(): string;
  getHeadings(): { depth: number; slug: string; text: string }[];
}

/** 分类元数据 */
export interface CategoryMeta {
  name?: string;
  description?: string;
}

/** 面包屑项 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** 文章列表项（用于索引页） */
export interface PostItem {
  slug: string;
  title: string;
  date: string;
  description: string;
  image: string;
  tags: string[];
  pinned: boolean;
  category: string;
  categoryDisplayName: string;
}

// ========== 分类元数据 ==========

/**
 * 从 import.meta.glob 结果中构建分类元数据字典
 */
export function buildCategoryMeta(
  globJsonFiles: Record<string, any>,
  globMdFiles: Record<string, any>,
): Record<string, CategoryMeta> {
  const meta: Record<string, CategoryMeta> = {};

  for (const [fp, m] of Object.entries(globJsonFiles)) {
    const key = fp.replace("../../content/posts/", "").replace("/index.json", "");
    meta[key] = (m as any).default || m;
  }

  for (const [fp, m] of Object.entries(globMdFiles)) {
    const key = fp.replace("../../content/posts/", "").replace("/index.md", "");
    if (!meta[key]) {
      meta[key] = {
        name: (m as any).frontmatter?.name,
        description: (m as any).frontmatter?.description,
      };
    }
  }

  return meta;
}

// ========== 路径与分类判断 ==========

/**
 * 从文件路径中提取分类
 * filePath 形如 "../../content/posts/tech/frontend/react/react-hooks.md"
 * 返回 "tech/frontend/react"，根级文章返回 ""
 */
export function extractCategoryFromFilePath(filePath: string): string {
  const p = filePath.replace("../../content/posts/", "").replace(/\.md$/, "");
  const parts = p.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

/**
 * 从 slug 中提取分类
 */
export function extractCategoryFromSlug(slug: string): string {
  const parts = slug.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

/**
 * 判断路径是否为分类索引（index.json 或 index.md）
 */
export function isCategoryPath(path: string): boolean {
  return path.endsWith("/index") || path === "index";
}

/**
 * 获取分类的显示名称
 */
export function getCategoryDisplayName(
  category: string,
  categoryMeta: Record<string, CategoryMeta>,
): string {
  if (!category) return "";
  return categoryMeta[category]?.name || category.split("/").pop() || category;
}

// ========== 面包屑 ==========

/**
 * 为分类页面构建面包屑导航
 */
export function buildCategoryBreadcrumbs(
  category: string,
  categoryMeta: Record<string, CategoryMeta>,
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "文章", href: "/posts/" }];
  const parts = category.split("/");
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    currentPath += (i > 0 ? "/" : "") + parts[i];
    const catName = categoryMeta[currentPath]?.name || parts[i];

    if (i < parts.length - 1) {
      breadcrumbs.push({ label: catName, href: `/posts/${currentPath}/` });
    } else {
      breadcrumbs.push({ label: catName });
    }
  }

  return breadcrumbs;
}

/**
 * 为文章页面构建面包屑导航
 */
export function buildPostBreadcrumbs(
  postCategory: string,
  postTitle: string,
  categoryMeta: Record<string, CategoryMeta>,
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "文章", href: "/posts/" }];

  if (postCategory) {
    let bp = "";
    for (const cp of postCategory.split("/")) {
      bp += bp ? "/" + cp : cp;
      const catLabel = categoryMeta[bp]?.name || cp;
      breadcrumbs.push({ label: catLabel, href: `/posts/${bp}/` });
    }
  }

  breadcrumbs.push({ label: postTitle });
  return breadcrumbs;
}

// ========== 文章列表 ==========

/**
 * 判断文章是否属于某个分类（包含子分类）
 */
export function isPostInCategory(postPath: string, category: string): boolean {
  return postPath === category || postPath.startsWith(category + "/");
}

/**
 * 从 import.meta.glob 结果中筛选并排序某个分类下的文章
 */
export function getCategoryPosts(
  allPostModules: Record<string, any>,
  category: string,
): { slug: string; frontmatter: any }[] {
  const posts: { slug: string; frontmatter: any }[] = [];

  for (const [fp, mod] of Object.entries(allPostModules)) {
    const p = (fp as string).replace("../../content/posts/", "").replace(/\.md$/, "");
    if (isCategoryPath(p)) continue;

    const postCategory = extractCategoryFromFilePath(fp);
    if (isPostInCategory(postCategory, category)) {
      posts.push({ slug: p, frontmatter: (mod as any).frontmatter });
    }
  }

  sortPosts(posts);
  return posts;
}

/**
 * 从 import.meta.glob 结果中构建全部文章列表（用于索引页）
 */
export function buildAllPosts(
  postModules: Record<string, any>,
  categoryMeta: Record<string, CategoryMeta>,
): PostItem[] {
  const posts: PostItem[] = [];

  for (const [filePath, mod] of Object.entries(postModules)) {
    const p = filePath.replace("../../content/posts/", "").replace(/\.md$/, "");
    if (isCategoryPath(p)) continue;

    const category = extractCategoryFromFilePath(filePath);
    const fm = (mod as any).frontmatter;
    posts.push({
      slug: p,
      title: fm.title || "无标题",
      date: fm.date || "",
      description: fm.description || "",
      image: fm.image || "",
      tags: fm.tags || [],
      pinned: fm.pinned || false,
      category,
      categoryDisplayName: getCategoryDisplayName(category, categoryMeta),
    });
  }

  sortPosts(posts);
  return posts;
}

// ========== 通用工具 ==========

/**
 * 对文章列表排序：置顶优先，然后按日期降序
 * 支持 frontmatter 包裹或扁平结构
 */
export function sortPosts(posts: any[]): void {
  posts.sort((a, b) => {
    const aPinned = a.frontmatter?.pinned ?? a.pinned;
    const bPinned = b.frontmatter?.pinned ?? b.pinned;
    const aDate = a.frontmatter?.date ?? a.date;
    const bDate = b.frontmatter?.date ?? b.date;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
  });
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}