// feature-build.mjs — 使用独立配置、缓存与产物验证功能隔离
// 用法：node tests/feature-build.mjs；不改写日常配置
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { features } from '../src/data/config.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONFIG = join(ROOT, 'src/data/config.ts');
const ORIGINAL = readFileSync(CONFIG);
const REQUIRE = createRequire(import.meta.url);
const ASTRO = join(dirname(REQUIRE.resolve('astro/package.json')), 'astro.js');
const LOCK = join(ROOT, '.astro/feature-check.lock');
const RESULTS = [];
const ALL_PAGES = Object.fromEntries(Object.keys(features.pages).map((key) => [key, true]));

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

const scenarios = [
  {
    name: 'minimal-frontend',
    pages: Object.fromEntries(Object.keys(features.pages).map((key) => [key, false])),
    endpoints: { sitemap: false, postsRss: false },
  },
  {
    name: 'without-posts',
    pages: { ...ALL_PAGES, posts: false },
    endpoints: { sitemap: true, postsRss: true },
  },
  {
    name: 'without-endpoints',
    pages: ALL_PAGES,
    endpoints: { sitemap: false, postsRss: false },
  },
];

mkdirSync(dirname(LOCK), { recursive: true });
writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
try {
  for (const scenario of scenarios) {
    const selected = { pages: scenario.pages, endpoints: scenario.endpoints };
    const scenarioRoot = join(ROOT, '.astro/feature-check', scenario.name);
    const output = join(scenarioRoot, 'dist');
    const reports = join(scenarioRoot, 'reports');
    const configFile = join(scenarioRoot, 'astro.config.ts');
    mkdirSync(scenarioRoot, { recursive: true });
    writeFileSync(
      configFile,
      [
        '// astro.config.ts — 功能验证专用构建配置',
        "import { createSiteConfig } from '../../../astro.config';",
        "import type { FeatureConfig } from '../../../src/data/config';",
        `const features: FeatureConfig = ${JSON.stringify(selected, null, 2)};`,
        'export default createSiteConfig(features, {',
        "  cacheDir: new URL('./cache/', import.meta.url),",
        "  reportDir: new URL('./reports/', import.meta.url),",
        '});',
        '',
      ].join(String.fromCharCode(10)),
    );
    const result = spawnSync(
      process.execPath,
      [
        ASTRO,
        'build',
        '--config',
        relative(ROOT, configFile).replaceAll(String.fromCharCode(92), '/'),
        '--outDir',
        output,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    writeFileSync(join(scenarioRoot, 'build.log'), (result.stdout ?? '') + (result.stderr ?? ''));
    assert.equal(
      result.status,
      0,
      `${scenario.name} 构建失败：${result.error ?? result.stderr}
${result.stdout?.slice(-5000)}`,
    );
    assert.deepEqual(readFileSync(CONFIG), ORIGINAL, '日常配置在验证期间被改动');
    const routeReport = JSON.parse(readFileSync(join(reports, 'feature-routes.json'), 'utf8'));
    const clientReport = JSON.parse(readFileSync(join(reports, 'feature-client.json'), 'utf8'));
    assert.deepEqual(routeReport.features, selected, '路由没有使用测试配置');
    assert.deepEqual(clientReport.features, selected, '客户端没有使用测试配置');
    const outputFiles = files(output);
    const text = outputFiles
      .filter((file) => /[.](html|css|js|mjs|xml|txt)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join(String.fromCharCode(10));
    assert.equal(existsSync(join(output, 'sitemap.xml')), selected.endpoints.sitemap);
    assert.equal(
      existsSync(join(output, 'posts/rss.xml')),
      selected.pages.posts && selected.endpoints.postsRss,
    );
    assert.equal(existsSync(join(output, 'css/giscus.css')), selected.pages.posts);
    for (const path of [
      'index.html',
      '404.html',
      'admin/index.html',
      'admin/categories/index.html',
      'admin/friends/index.html',
      'admin/info/site/index.html',
      'admin/info/sponsor/index.html',
      'admin/info/quotes/index.html',
      'admin/posts/list/index.html',
      'admin/posts/edit/index.html',
      'admin/profile/base/index.html',
      'admin/profile/social/index.html',
      'admin/profile/timeline/index.html',
      'admin/profile/techstack/index.html',
      'admin/settings/features/index.html',
      'admin/settings/nav/index.html',
      'admin/settings/background/index.html',
      'admin/settings/integrations/index.html',
      'admin/tools/index.html',
      'admin/404/index.html',
    ]) {
      assert.equal(existsSync(join(output, path)), true, `固定路由缺失：${path}`);
    }
    const homepage = readFileSync(join(output, 'index.html'), 'utf8');
    const sitemap = selected.endpoints.sitemap
      ? readFileSync(join(output, 'sitemap.xml'), 'utf8')
      : '';
    for (const [key, isEnabled] of Object.entries(selected.pages)) {
      assert.equal(existsSync(join(output, key, 'index.html')), isEnabled, `${key} 路由开关不符`);
      if (!isEnabled) {
        assert.equal(homepage.includes(`href="/${key}/"`), false, `导航仍包含 ${key}`);
        assert.equal(sitemap.includes(`/${key}/`), false, `站点地图仍包含 ${key}`);
        assert.equal(
          JSON.stringify(clientReport.chunks).includes(`/features/${key}/`),
          false,
          `${key} 模块残留`,
        );
      }
    }
    if (!selected.pages.posts) {
      assert.equal(existsSync(join(output, 'posts')), false);
      assert.equal(existsSync(join(output, 'pagefind')), false);
      assert.doesNotMatch(
        text,
        /posts-search-float|posts-filter-fab|__postsShellInit|pagefind[.]js|giscus[.]app|pswp__|--page-edge-blur/,
      );
    }
    if (!selected.pages.posts || !selected.endpoints.postsRss) {
      assert.equal(homepage.includes('/posts/rss.xml'), false);
    }
    assert.match(readFileSync(join(output, 'robots.txt'), 'utf8'), /Disallow: [/]admin[/]/);
    const htmlFiles = outputFiles.filter((file) => file.endsWith('.html'));
    if (scenario.name === 'minimal-frontend') assert.equal(htmlFiles.length, 20);
    RESULTS.push({
      scenario: scenario.name,
      html: htmlFiles.length,
      files: outputFiles.length,
      bytes: outputFiles.reduce((sum, file) => sum + readFileSync(file).length, 0),
      output: relative(ROOT, output),
    });
    console.log(
      `[features] ${scenario.name} 通过：${htmlFiles.length} 个页面，${outputFiles.length} 个文件`,
    );
  }
} finally {
  unlinkSync(LOCK);
  writeFileSync(join(ROOT, '.astro/feature-check-results.json'), JSON.stringify(RESULTS, null, 2));
  assert.deepEqual(readFileSync(CONFIG), ORIGINAL, '日常配置在验证期间被改动，请检查编辑冲突');
}
