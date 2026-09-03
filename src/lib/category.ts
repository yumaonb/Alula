// category.ts - 分类逻辑模块
//
// 实现文档定义的全自动多级分类兼容方案：
// 1. Frontmatter 显式定义（最高优先级）
// 2. 目录结构隐式定义（回退）
// 3. 默认"未分类"（兜底）
//
// 后续适配多种分类方式时只需修改此文件，页面组件无需改动。

// ========== 配置 ==========

import { posts, type CategoryConfig } from "../data/posts";
export type { CategoryConfig };
export const defaultConfig: CategoryConfig = posts.category;
export const contentRoot: string = posts.contentRoot;

/**
 * 从 Astro 页面组件的文件路径中自动识别路由前缀
 * 例如 "src/pages/posts/[...slug].astro" → "posts"
 * @param importMetaUrl - 页面组件中的 import.meta.url
 */
export function resolveRoutePrefix(importMetaUrl: string): string {
  const url = new URL(importMetaUrl);
  const dir = url.pathname.replace(/\\/g, "/");
  // 匹配 .../pages/{folder}/... 模式
  const match = dir.match(/\/pages\/([^/]+)\//);
  return match ? match[1] : "posts";
}

/**
 * 从 import.meta.glob 的 key 中提取相对路径
 * 去除 contentRoot 前缀和 .md 后缀
 */
export function stripContentRoot(filePath: string): string {
  // 匹配任意 content/posts 前缀（兼容不同目录结构）
  const prefixPattern = new RegExp(`^.*?${escapeRegExp(contentRoot)}/`);
  return filePath.replace(prefixPattern, "").replace(/\.md$/, "");
}

/**
 * 从 slug 中提取分类
 * slug 如 "tech/frontend/react" → ["tech", "frontend"]
 */
export function extractCategoryFromSlug(slug: string): string[] {
  const parts = slug.split("/");
  return parts.length > 1 ? parts.slice(0, -1) : [];
}

/**
 * 从文件路径中提取分类（目录结构推断）
 */
export function extractCategoryFromFilePath(filePath: string): string[] {
  const clean = stripContentRoot(filePath);
  const parts = clean.split("/");
  return parts.length > 1 ? parts.slice(0, -1) : [];
}

// ========== 轻量级 YAML 解析 ==========

/**
 * 解析简单的 YAML 格式（key: value，支持字符串、布尔、数字）
 * 不依赖外部库，仅处理分类配置文件的常见格式
 */
function parseSimpleYaml(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    // 跳过注释和空行
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // 匹配 key: value
    const match = trimmed.match(/^(['"]?)(\w+)\1\s*:\s*(.+)$/);
    if (match) {
      const [, , key, rawValue] = match;
      const val = rawValue.trim();
      // 布尔值
      if (val === "true") { result[key] = true; continue; }
      if (val === "false") { result[key] = false; continue; }
      // 去除引号
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        result[key] = val.slice(1, -1);
        continue;
      }
      // 数字
      const num = Number(val);
      if (!isNaN(num) && val !== "") { result[key] = num; continue; }
      // 字符串
      result[key] = val;
    }
  }
  return result;
}

// ========== 轻量级 TOML 解析 ==========

/**
 * 解析简单的 TOML 格式（key = value）
 * 仅处理分类配置文件的常见格式，不支持嵌套表和数组
 */
function parseSimpleToml(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // 匹配 key = value
    const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      const [, key, rawValue] = match;
      const val = rawValue.trim();
      if (val === "true") { result[key] = true; continue; }
      if (val === "false") { result[key] = false; continue; }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        result[key] = val.slice(1, -1);
        continue;
      }
      const num = Number(val);
      if (!isNaN(num) && val !== "") { result[key] = num; continue; }
      result[key] = val;
    }
  }
  return result;
}

/** 根据文件扩展名选择解析器 */
function parseConfigFile(content: any, filePath: string): Record<string, any> {
  const raw = (content as any).default || content;
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw !== "string") return {};
  if (filePath.endsWith(".toml")) return parseSimpleToml(raw);
  return parseSimpleYaml(raw);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    categories?: any;
    category?: any;
    "分类"?: any;
  };
  compiledContent(): string;
  getHeadings(): { depth: number; slug: string; text: string }[];
}

/** 分类元数据（来自目录下的配置文件） */
export interface CategoryMeta {
  name?: string;
  description?: string;
  title?: string;
}

/** 标准分类节点 */
export interface CategoryNode {
  name: string;
  slug: string;
  path: string[];
  level: number;
}

/** 文章分类信息 */
export interface ArticleCategories {
  fullPath: CategoryNode[];
  root: CategoryNode | null;
  leaf: CategoryNode | null;
}

/** 面包屑项 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string; // astro-icon name, e.g. "la:home"
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
  /** 分类路径 slug，如 "tech/frontend" */
  category: string;
  /** 分类显示名称，如 "前端" */
  categoryDisplayName: string;
}

// ========== Frontmatter 分类提取 ==========

/**
 * 从 frontmatter 中提取分类层级数组
 * 按文档规定的顺序自动检测数据类型：
 * 1. 嵌套数组 → 取第一层
 * 2. 对象数组（含 name/parent）→ 递归构建树
 * 3. 字符串数组 → 按顺序作为层级
 * 4. 字符串 → 检测分隔符拆分
 * 5. 其他 → 转字符串尝试
 *
 * @returns 分类层级 slug 数组，如 ["tech", "frontend"]，提取失败返回 null
 */
export function extractCategoriesFromFrontmatter(frontmatter: any): string[] | null {
  const cat =
    frontmatter?.categories ??
    frontmatter?.category ??
    frontmatter?.["分类"];

  // 空值检测
  if (cat === null || cat === undefined) return null;
  if (Array.isArray(cat) && cat.length === 0) return null;
  if (typeof cat === "string" && cat.trim() === "") return null;

  // 检测1：嵌套数组
  if (Array.isArray(cat) && cat.length > 0 && Array.isArray(cat[0])) {
    return cat[0] as string[];
  }

  // 检测2：对象数组（含 name/parent 字段）
  if (Array.isArray(cat) && cat.length > 0 && typeof cat[0] === "object" && cat[0]?.name) {
    const nodes = new Map<string, { name: string; parent?: string }>();
    for (const item of cat) {
      if (item?.name) nodes.set(item.name, item);
    }
    // 找根节点（没有 parent 的）
    const roots = [...nodes.values()].filter((n) => !n.parent);
    if (roots.length > 0) {
      const path: string[] = [];
      let current: { name: string; parent?: string } | undefined = roots[0];
      while (current) {
        path.push(slugify(current.name));
        const children = [...nodes.values()].filter((n) => n.parent === current!.name);
        current = children[0];
      }
      return path;
    }
    // 所有节点都有 parent，按 parent 链构建
    if (cat.length > 0) {
      const chain: string[] = [];
      let current: any = cat[cat.length - 1];
      while (current) {
        chain.unshift(slugify(current.name));
        current = current.parent ? nodes.get(current.parent) : null;
      }
      return chain;
    }
    return null;
  }

  // 检测3：字符串数组
  if (Array.isArray(cat) && cat.length > 0 && typeof cat[0] === "string") {
    return cat.map((s: string) => slugify(s));
  }

  // 检测4：字符串
  if (typeof cat === "string") {
    const trimmed = cat.trim();
    if (trimmed.includes("/") || trimmed.includes(">")) {
      return trimmed
        .split(/[\/>]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) => slugify(s));
    }
    return [slugify(trimmed)];
  }

  // 检测5：其他情况，尝试转字符串
  try {
    const s = String(cat).trim();
    if (s && s !== "[object Object]" && s !== "undefined") {
      return [slugify(s)];
    }
  } catch {
    // 忽略
  }

  return null;
}

// ========== 分类元数据 ==========

/**
 * 从 import.meta.glob 结果中构建分类元数据字典
 * 支持的配置文件（按优先级）：
 * - _category.yml / _category.yaml
 * - category.json
 * - _category.toml
 * - .category.yml
 * - index.md（frontmatter）
 */
export function buildCategoryMeta(
  globJsonFiles: Record<string, any>,
  globMdFiles: Record<string, any>,
  globYamlFiles?: Record<string, any>,
  globTomlFiles?: Record<string, any>,
): Record<string, CategoryMeta> {
  const meta: Record<string, CategoryMeta> = {};

  // 优先级1: _category.yml / _category.yaml / .category.yml
  if (globYamlFiles) {
    for (const [fp, m] of Object.entries(globYamlFiles)) {
      const key = stripCategoryFilepath(fp);
      if (!key) continue;
      const parsed = parseConfigFile(m, fp);
      if (Object.keys(parsed).length > 0) {
        meta[key] = {
          name: parsed.name,
          description: parsed.description,
          title: parsed.title,
        };
      }
    }
  }

  // 优先级2: category.json / index.json
  for (const [fp, m] of Object.entries(globJsonFiles)) {
    const key = stripCategoryFilepath(fp);
    if (!key) continue;
    if (!meta[key]) {
      meta[key] = (m as any).default || m;
    }
  }

  // 优先级3: _category.toml
  if (globTomlFiles) {
    for (const [fp, m] of Object.entries(globTomlFiles)) {
      const key = stripCategoryFilepath(fp);
      if (!key) continue;
      if (!meta[key]) {
        const parsed = parseConfigFile(m, fp);
        meta[key] = {
          name: parsed.name,
          description: parsed.description,
          title: parsed.title,
        };
      }
    }
  }

  // 优先级4: index.md（frontmatter）
  for (const [fp, m] of Object.entries(globMdFiles)) {
    const key = stripCategoryFilepath(fp);
    if (!key) continue;
    if (!meta[key]) {
      meta[key] = {
        name: (m as any).frontmatter?.name,
        description: (m as any).frontmatter?.description,
      };
    }
  }

  return meta;
}

/**
 * 从配置文件路径中提取分类目录 key
 * 如 "../../content/posts/tech/_category.yml" → "tech"
 */
function stripCategoryFilepath(fp: string): string | null {
  const prefixPattern = new RegExp(`^.*?${escapeRegExp(contentRoot)}/`);
  let key = fp.replace(prefixPattern, "");
  // 去除配置文件名
  key = key
    .replace(/\/_category\.(ya?ml|toml)$/, "")
    .replace(/\/\.category\.(ya?ml)$/, "")
    .replace(/\/category\.json$/, "")
    .replace(/\/index\.(json|md)$/, "");
  return key || null;
}

// ========== Slug 生成 ==========

/**
 * 将分类名称转换为 URL 友好的 slug
 * 中文保留 UTF-8，空格转连字符，去除特殊字符
 */
export function slugify(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ========== 分类信息构建 ==========

/**
 * 构建文章的完整分类信息
 * @param frontmatterCategories - 从 frontmatter 提取的分类 slug 数组
 * @param directoryCategories - 从目录结构提取的分类 slug 数组
 * @param categoryMeta - 分类元数据字典
 * @returns 统一的 ArticleCategories 结构
 */
export function buildArticleCategories(
  frontmatterCategories: string[] | null,
  directoryCategories: string[],
  categoryMeta: Record<string, CategoryMeta>,
): ArticleCategories {
  // 优先级1: Frontmatter 显式定义
  const rawPath = frontmatterCategories && frontmatterCategories.length > 0
    ? frontmatterCategories
    : directoryCategories.length > 0
      ? directoryCategories
      : [];

  if (rawPath.length === 0) {
    return { fullPath: [], root: null, leaf: null };
  }

  const fullPath: CategoryNode[] = rawPath.map((segment, i) => {
    const metaKey = rawPath.slice(0, i + 1).join("/");
    const meta = categoryMeta[metaKey];
    return {
      name: meta?.name || segment,
      slug: segment,
      path: rawPath.slice(0, i + 1),
      level: i,
    };
  });

  return {
    fullPath,
    root: fullPath[0] || null,
    leaf: fullPath[fullPath.length - 1] || null,
  };
}

// ========== 显示名称 ==========

/**
 * 获取分类的显示名称
 */
export function getCategoryDisplayName(
  categoryPath: string[],
  categoryMeta: Record<string, CategoryMeta>,
): string {
  if (categoryPath.length === 0) return "";
  const lastSegment = categoryPath[categoryPath.length - 1];
  const metaKey = categoryPath.join("/");
  return categoryMeta[metaKey]?.name || lastSegment;
}

// ========== 面包屑 ==========

/**
 * 为分类页面构建面包屑导航
 */
export function buildCategoryBreadcrumbs(
  categoryPath: string[],
  categoryMeta: Record<string, CategoryMeta>,
  routePrefix: string,
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "文章首页", href: `/${routePrefix}/`, icon: "la:home" }];
  let currentPath: string[] = [];

  for (let i = 0; i < categoryPath.length; i++) {
    currentPath.push(categoryPath[i]);
    const catName = categoryMeta[currentPath.join("/")]?.name || categoryPath[i];

    if (i < categoryPath.length - 1) {
      breadcrumbs.push({ label: catName, href: buildCategoryUrl(currentPath, categoryMeta, routePrefix) });
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
  categoryPath: string[],
  postTitle: string,
  categoryMeta: Record<string, CategoryMeta>,
  routePrefix: string,
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "文章首页", href: `/${routePrefix}/`, icon: "la:home" }];
  let currentPath: string[] = [];

  for (const segment of categoryPath) {
    currentPath.push(segment);
    const catLabel = categoryMeta[currentPath.join("/")]?.name || segment;
    breadcrumbs.push({ label: catLabel, href: buildCategoryUrl(currentPath, categoryMeta, routePrefix) });
  }

  breadcrumbs.push({ label: postTitle });
  return breadcrumbs;
}

// ========== URL 生成 ==========

/**
 * 生成分类的 URL
 * 格式: /[routePrefix]/[categoryBase/]slug1/slug2/
 */
export function buildCategoryUrl(
  categoryPath: string[],
  categoryMeta: Record<string, CategoryMeta>,
  routePrefix: string,
  config: CategoryConfig = defaultConfig,
): string {
  const parts: string[] = [routePrefix];
  if (config.categoryBase) parts.push(config.categoryBase);
  parts.push(...categoryPath);
  return "/" + parts.join("/") + "/";
}

// ========== 文章筛选 ==========

/**
 * 判断文章是否属于某个分类（包含子分类匹配）
 * 同时检查 frontmatter 分类和目录分类
 */
export function isPostInCategory(
  postFrontmatterCategories: string[] | null,
  postDirectoryCategories: string[],
  targetCategoryPath: string[],
): boolean {
  const targetKey = targetCategoryPath.join("/");

  // 检查 frontmatter 分类
  if (postFrontmatterCategories && postFrontmatterCategories.length > 0) {
    for (let i = 1; i <= postFrontmatterCategories.length; i++) {
      const subPath = postFrontmatterCategories.slice(0, i).join("/");
      if (subPath === targetKey) return true;
    }
  }

  // 检查目录分类
  if (postDirectoryCategories.length > 0) {
    for (let i = 1; i <= postDirectoryCategories.length; i++) {
      const subPath = postDirectoryCategories.slice(0, i).join("/");
      if (subPath === targetKey) return true;
    }
  }

  return false;
}

/**
 * 从 import.meta.glob 结果中筛选并排序某个分类下的文章
 */
export function getCategoryPosts(
  allPostModules: Record<string, any>,
  targetCategoryPath: string[],
  categoryMeta: Record<string, CategoryMeta>,
): { slug: string; frontmatter: any; category: string }[] {
  const result: { slug: string; frontmatter: any; category: string }[] = [];

  for (const [fp, mod] of Object.entries(allPostModules)) {
    const clean = stripContentRoot(fp as string);
    if (isCategoryPath(clean)) continue;

    const fm = (mod as any).frontmatter;
    const fmCategories = extractCategoriesFromFrontmatter(fm);
    const dirCategories = extractCategoryFromFilePath(fp);

    if (isPostInCategory(fmCategories, dirCategories, targetCategoryPath)) {
      const articleCats = buildArticleCategories(fmCategories, dirCategories, categoryMeta);
      result.push({
        slug: clean,
        frontmatter: fm,
        category: articleCats.leaf ? articleCats.leaf.path.join("/") : clean.split("/").slice(0, -1).join("/"),
      });
    }
  }

  sortPosts(result);
  return result;
}

/**
 * 从 import.meta.glob 结果中构建全部文章列表（用于索引页）
 */
export function buildAllPosts(
  postModules: Record<string, any>,
  categoryMeta: Record<string, CategoryMeta>,
): PostItem[] {
  const result: PostItem[] = [];

  for (const [filePath, mod] of Object.entries(postModules)) {
    const clean = stripContentRoot(filePath);
    if (isCategoryPath(clean)) continue;

    const fm = (mod as any).frontmatter;
    const fmCategories = extractCategoriesFromFrontmatter(fm);
    const dirCategories = extractCategoryFromFilePath(filePath);
    const articleCats = buildArticleCategories(fmCategories, dirCategories, categoryMeta);

    result.push({
      slug: clean,
      title: fm.title || "无标题",
      date: fm.date || "",
      description: fm.description || "",
      image: fm.image || "",
      tags: fm.tags || [],
      pinned: fm.pinned || false,
      category: articleCats.leaf ? articleCats.leaf.path.join("/") : "",
      categoryDisplayName: articleCats.leaf ? articleCats.leaf.name : "",
    });
  }

  sortPosts(result);
  return result;
}

/**
 * 构建分类树（含各层级中间节点）
 * count 为该分类及其所有子孙分类下的文章总数
 */
export interface CategoryTreeNode {
  /** 完整 slug 路径，如 "devnotes/css" */
  path: string;
  /** 显示名称 */
  name: string;
  /** 子树内的文章总数 */
  count: number;
  children: CategoryTreeNode[];
}

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

  // 为所有层级创建节点，并把文章计入叶子节点
  for (const post of posts) {
    if (!post.category) continue;
    const parts = post.category.split('/');
    for (let i = 1; i <= parts.length; i++) ensure(parts.slice(0, i).join('/'));
    ensure(post.category).count += 1;
  }

  // 填充显示名称
  for (const [path, node] of nodes) {
    const last = path.split('/').pop() || path;
    node.name = categoryMeta[path]?.name || last;
  }

  // 自底向上汇总子树计数并排序
  const finalize = (node: CategoryTreeNode): void => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    for (const child of node.children) {
      finalize(child);
      node.count += child.count;
    }
  };

  const roots = [...nodes.values()].filter(n => !n.path.includes('/'));
  roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
  for (const root of roots) finalize(root);
  return roots;
}

// ========== 分类路径收集 ==========

/**
 * 从所有文章的 frontmatter 中收集全部唯一的分类路径
 * 用于在 getStaticPaths 中生成分类页面路由
 */
export function collectAllCategoryPaths(
  postModules: Record<string, any>,
): string[] {
  const categorySet = new Set<string>();

  for (const [fp, mod] of Object.entries(postModules)) {
    const clean = stripContentRoot(fp as string);
    if (isCategoryPath(clean)) continue;

    const fm = (mod as any).frontmatter;
    const fmCategories = extractCategoriesFromFrontmatter(fm);
    if (!fmCategories || fmCategories.length === 0) continue;

    // 收集每一级父路径：["技术", "前端", "React"] → "技术", "技术/前端", "技术/前端/React"
    for (let i = 1; i <= fmCategories.length; i++) {
      categorySet.add(fmCategories.slice(0, i).join("/"));
    }
  }

  return [...categorySet];
}

// ========== 通用工具 ==========

/**
 * 判断路径是否为分类索引文件
 */
export function isCategoryPath(path: string): boolean {
  return path.endsWith("/index") || path === "index";
}

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