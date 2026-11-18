// data-schemas.ts — 后台数据页的表单字段声明（页面 → src/data 文件 + 字段）
// 用法：import { DATA_PAGE_SPECS } from './data-schemas'
//
// 字段由 data-form.ts 渲染成表单控件，值经 ts-literal.ts 写回文件。
// 这里声明的字段对应配置字段；文件里未声明的字段原样保留，
// 配置新增字段不需要改页面，也不会被表单丢掉。

export interface DataFieldBase {
  hint?: string;
}

export type DataField =
  | (DataFieldBase & { kind: 'group'; title?: string; fields: DataField[] })
  | (DataFieldBase & { kind: 'object'; key: string; title?: string; fields: DataField[] })
  | (DataFieldBase & {
      kind: 'record';
      key: string;
      title?: string;
      /** 嵌套在条目内时显示的字段名（默认取 title） */
      label?: string;
      addLabel?: string;
      fields: DataField[];
    })
  | (DataFieldBase & {
      kind: 'list';
      key: string;
      title?: string;
      /** 嵌套在条目内时显示的字段名（默认取 title） */
      label?: string;
      addLabel?: string;
      fields: DataField[];
    })
  | (DataFieldBase & {
      kind: 'text';
      key: string;
      label: string;
      placeholder?: string;
      optional?: boolean;
    })
  | (DataFieldBase & {
      kind: 'textarea';
      key: string;
      label: string;
      rows?: number;
      placeholder?: string;
      optional?: boolean;
    })
  | (DataFieldBase & {
      kind: 'number';
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
    })
  | (DataFieldBase & { kind: 'date'; key: string; label: string })
  | (DataFieldBase & { kind: 'toggle'; key: string; label: string })
  | (DataFieldBase & {
      kind: 'select';
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
    })
  | (DataFieldBase & { kind: 'tags'; key: string; label: string; placeholder?: string });

export interface DataFileSpec {
  path: string;
  title: string;
  schema: DataField[];
}

export interface DataPageSpec {
  files: DataFileSpec[];
}

export const DATA_PAGE_SPECS: Record<string, DataPageSpec> = {
  /* ---- 系统设置 ---- */

  'settings-features': {
    files: [
      {
        path: 'src/data/config.ts',
        title: 'config.ts',
        schema: [
          {
            kind: 'object',
            key: 'features',
            fields: [
              {
                kind: 'object',
                key: 'pages',
                title: '页面',
                fields: [
                  { kind: 'toggle', key: 'about', label: '关于' },
                  { kind: 'toggle', key: 'projects', label: '项目' },
                  { kind: 'toggle', key: 'posts', label: '文章' },
                  { kind: 'toggle', key: 'tools', label: '工具' },
                  { kind: 'toggle', key: 'friends', label: '友链' },
                  { kind: 'toggle', key: 'sponsor', label: '赞助' },
                ],
              },
              {
                kind: 'object',
                key: 'endpoints',
                title: '端点',
                fields: [
                  { kind: 'toggle', key: 'sitemap', label: '站点地图（sitemap）' },
                  { kind: 'toggle', key: 'postsRss', label: '文章 RSS' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  'settings-nav': {
    files: [
      {
        path: 'src/data/nav.ts',
        title: 'nav.ts',
        schema: [
          {
            kind: 'record',
            key: 'navConfig',
            title: '导航条目',
            addLabel: '添加导航项',
            hint: '顺序即显示顺序。键名必须与功能开关一致（home / about / projects / posts / tools / friends / sponsor），地址由路由声明派生，改这里只管名称与图标。',
            fields: [
              { kind: 'text', key: 'label', label: '名称' },
              { kind: 'text', key: 'icon', label: '图标', placeholder: 'la:home' },
            ],
          },
        ],
      },
    ],
  },

  'settings-background': {
    files: [
      {
        path: 'src/data/background.ts',
        title: 'background.ts',
        schema: [
          {
            kind: 'object',
            key: 'background',
            fields: [
              {
                kind: 'select',
                key: 'type',
                label: '背景类型',
                options: [
                  { value: 'css', label: 'CSS 预设（assets/backgrounds/css/）' },
                  { value: 'image', label: '图片（assets/backgrounds/images/）' },
                ],
              },
              {
                kind: 'text',
                key: 'path',
                label: '文件名',
                placeholder: 'wave-dots.css / bj.jpg',
                hint: '只填文件名（不含目录），type 决定去哪个文件夹找；写错会在构建期直接报错。',
              },
              {
                kind: 'number',
                key: 'scrim',
                label: '压暗强度',
                min: 0,
                max: 1,
                step: 0.05,
                hint: '0 为不压暗；图片偏亮、玻璃卡片上的文字对比度不够时调大。',
              },
            ],
          },
        ],
      },
    ],
  },

  'settings-integrations': {
    files: [
      {
        path: 'src/data/github.ts',
        title: 'github.ts',
        schema: [
          {
            kind: 'group',
            title: '评论（giscus）',
            fields: [
              {
                kind: 'text',
                key: 'giscusRepo',
                label: '数据仓库',
                placeholder: 'owner/repo',
                hint: '换仓库要连下面两个 id 一起换，id 属于仓库，不能单独沿用。',
              },
              { kind: 'text', key: 'giscusRepoId', label: '仓库 id', placeholder: 'R_kg…' },
              { kind: 'text', key: 'giscusCategoryId', label: '讨论区 id', placeholder: 'DIC_…' },
              { kind: 'text', key: 'giscusCategory', label: '讨论区名', placeholder: 'Comments' },
            ],
          },
          {
            kind: 'group',
            title: '项目',
            fields: [
              {
                kind: 'text',
                key: 'projectOwner',
                label: '仓库账号',
                hint: '项目列表与项目数量都取这个账号的仓库。',
              },
            ],
          },
          {
            kind: 'group',
            title: '后台',
            fields: [
              {
                kind: 'text',
                key: 'adminRepo',
                label: '默认连接的仓库',
                hint: '绑定令牌后可在后台改连别的仓库。',
              },
            ],
          },
        ],
      },
    ],
  },

  /* ---- 网站信息 ---- */

  'info-site': {
    files: [
      {
        path: 'src/data/site.ts',
        title: 'site.ts',
        schema: [
          {
            kind: 'object',
            key: 'site',
            fields: [
              { kind: 'text', key: 'name', label: '站点名称' },
              { kind: 'text', key: 'domain', label: '域名', hint: '不含协议。' },
              {
                kind: 'text',
                key: 'url',
                label: '站点绝对地址',
                hint: '含协议；分享卡、RSS、评论区等需要绝对 URL 的地方统一用它。',
              },
              { kind: 'textarea', key: 'description', label: '站点描述', rows: 2 },
              {
                kind: 'text',
                key: 'footerCopyright',
                label: '页脚版权',
                hint: 'RSS 的版权也用它，两边必须同一句。',
              },
              {
                kind: 'object',
                key: 'contentLicense',
                title: '内容许可',
                hint: '文章页「许可协议」与页脚都指向它。',
                fields: [
                  { kind: 'text', key: 'name', label: '许可名称', placeholder: 'CC BY-NC-SA 4.0' },
                  { kind: 'text', key: 'url', label: '许可全文链接' },
                ],
              },
              {
                kind: 'textarea',
                key: 'footerNote',
                label: '页脚说明',
                rows: 2,
                hint: '支持 HTML。',
              },
              { kind: 'text', key: 'lang', label: '语言', placeholder: 'zh-CN' },
            ],
          },
        ],
      },
    ],
  },

  'info-sponsor': {
    files: [
      {
        path: 'src/data/sponsor.ts',
        title: 'sponsor.ts',
        schema: [
          {
            kind: 'object',
            key: 'sponsorLink',
            title: '主赞助入口',
            fields: [
              { kind: 'text', key: 'name', label: '名称', placeholder: '爱发电' },
              { kind: 'text', key: 'href', label: '链接' },
              { kind: 'textarea', key: 'desc', label: '说明', rows: 2 },
              { kind: 'text', key: 'icon', label: '图标', placeholder: 'la:heart' },
            ],
          },
          {
            kind: 'object',
            key: 'sponsorList',
            title: '赞助名单入口',
            fields: [
              { kind: 'text', key: 'icon', label: '图标', placeholder: 'la:users' },
              { kind: 'text', key: 'title', label: '标题' },
              { kind: 'textarea', key: 'desc', label: '说明', rows: 2 },
              { kind: 'text', key: 'href', label: '链接' },
              { kind: 'text', key: 'target', label: '打开方式', placeholder: '_blank' },
            ],
          },
          {
            kind: 'list',
            key: 'supportActions',
            title: '其它支持方式',
            addLabel: '添加支持方式',
            fields: [
              { kind: 'text', key: 'icon', label: '图标', placeholder: 'la:star' },
              { kind: 'text', key: 'title', label: '标题' },
              { kind: 'textarea', key: 'desc', label: '说明', rows: 2 },
              { kind: 'text', key: 'href', label: '链接（可留空）', optional: true },
              {
                kind: 'text',
                key: 'target',
                label: '打开方式（可留空）',
                optional: true,
                placeholder: '_blank',
              },
            ],
          },
        ],
      },
    ],
  },

  'info-quotes': {
    files: [
      {
        path: 'src/data/quotes.ts',
        title: 'quotes.ts',
        schema: [
          {
            kind: 'list',
            key: 'quotes',
            title: '一言条目',
            addLabel: '添加一言',
            hint: '「名称」与「出处」可留空，留空后不显示来源。',
            fields: [
              { kind: 'textarea', key: 'text', label: '内容', rows: 3 },
              { kind: 'text', key: 'from', label: '效应 / 名称', optional: true },
              { kind: 'text', key: 'fromWho', label: '出处', optional: true },
            ],
          },
        ],
      },
    ],
  },

  /* ---- 个人信息 ---- */

  'profile-base': {
    files: [
      {
        path: 'src/data/profile.ts',
        title: 'profile.ts',
        schema: [
          { kind: 'text', key: 'nickname', label: '昵称' },
          { kind: 'text', key: 'motto', label: '座右铭' },
          {
            kind: 'textarea',
            key: 'intro',
            label: '首页自我介绍',
            rows: 6,
            hint: '支持 HTML，换行用 <br>。',
          },
        ],
      },
      {
        path: 'src/data/dayscounter.ts',
        title: 'dayscounter.ts',
        schema: [
          {
            kind: 'object',
            key: 'daysCounterConfig',
            fields: [
              { kind: 'text', key: 'label', label: '统计标签', placeholder: '入坑全栈' },
              { kind: 'date', key: 'startDate', label: '起始日期' },
            ],
          },
        ],
      },
    ],
  },

  'profile-social': {
    files: [
      {
        path: 'src/data/social-links.ts',
        title: 'social-links.ts',
        schema: [
          {
            kind: 'list',
            key: 'socialLinks',
            title: '联系方式',
            addLabel: '添加联系方式',
            hint: '顺序即显示顺序。RSS 由文章与订阅开关自动控制，不用手动添加。',
            fields: [
              { kind: 'text', key: 'icon', label: '图标', placeholder: 'simple-icons:github' },
              { kind: 'text', key: 'label', label: '名称' },
              { kind: 'text', key: 'url', label: '链接' },
            ],
          },
        ],
      },
    ],
  },

  'profile-timeline': {
    files: [
      {
        path: 'src/data/timeline.ts',
        title: 'timeline.ts',
        schema: [
          {
            kind: 'list',
            key: 'timeline',
            title: '历程条目',
            addLabel: '添加条目',
            hint: '条目顺序随意，站点按日期升序展示。',
            fields: [
              { kind: 'date', key: 'date', label: '日期' },
              { kind: 'text', key: 'title', label: '标题' },
              { kind: 'textarea', key: 'description', label: '描述', rows: 3 },
            ],
          },
        ],
      },
    ],
  },

  'profile-techstack': {
    files: [
      {
        path: 'src/data/techstack.ts',
        title: 'techstack.ts',
        schema: [
          {
            kind: 'list',
            key: 'techStack',
            title: '技术类别',
            addLabel: '添加类别',
            fields: [
              { kind: 'text', key: 'category', label: '类别' },
              {
                kind: 'tags',
                key: 'items',
                label: '技术',
                placeholder: 'HTML, CSS, JavaScript',
                hint: '用逗号分隔（中英文逗号都可以）。',
              },
            ],
          },
        ],
      },
    ],
  },

  /* ---- 友情链接 / 工具管理 ---- */

  friends: {
    files: [
      {
        path: 'src/data/friends.ts',
        title: 'friends.ts',
        schema: [
          {
            kind: 'list',
            key: 'friends',
            title: '友链',
            addLabel: '添加友链',
            hint: '头像填完整图片地址。',
            fields: [
              { kind: 'text', key: 'name', label: '名称' },
              { kind: 'text', key: 'avatar', label: '头像地址' },
              { kind: 'textarea', key: 'desc', label: '描述', rows: 2 },
              { kind: 'text', key: 'url', label: '链接' },
            ],
          },
        ],
      },
    ],
  },

  tools: {
    files: [
      {
        path: 'src/data/tools.ts',
        title: 'tools.ts',
        schema: [
          {
            kind: 'list',
            key: 'toolCategories',
            title: '工具分类',
            addLabel: '添加分类',
            fields: [
              { kind: 'text', key: 'title', label: '分类名' },
              {
                kind: 'list',
                key: 'tools',
                label: '工具',
                addLabel: '添加工具',
                fields: [
                  { kind: 'text', key: 'title', label: '名称' },
                  { kind: 'textarea', key: 'desc', label: '描述', rows: 2 },
                  { kind: 'text', key: 'url', label: '链接' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
