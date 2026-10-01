// nav-match.ts — 判断当前路径是否命中某个导航链接（路径落在链接目录内即命中）
// 用法：import { navMatch } from "../../lib/nav-match"
export function navMatch(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '';
  const base = href.endsWith('/') ? href : `${href}/`;
  return pathname === base.slice(0, -1) || pathname.startsWith(base);
}
