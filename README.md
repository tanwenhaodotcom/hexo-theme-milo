# Milo

当前版本：**0.3.1**（Pre-release）。

Milo 是使用 EJS、原生 CSS 和 JavaScript 构建的独立 Hexo 博客主题。没有前端框架和浏览器运行时依赖，文本和图片工具仅在构建期运行。

## 功能

- 简洁双栏布局、手机适配、浅色/深色/跟随系统
- 右上角搜索入口，本地全文索引仅搜索时加载
- 文章目录吸顶、平滑跳转和当前章节跟踪
- 年度归档、分类与标签、独立关于页
- 作者资料和字数统计，Disqus 按需加载
- 原生系统字体、内联 SVG 图标，无外部字体或前端框架

## 环境与安装

已验证 Node.js 26.13.0 / Hexo 8.1.2。主题声明 Node.js >=18，但 Hexo 8.1.2 要求 Node.js >=20.19；须同时满足所用 Hexo 和插件的要求。Hexo 7、Node.js 18 未验证。需先安装 Node.js、npm 和 Git。

新建站点时，在准备存放博客的父目录执行；已有 Hexo 站点可跳过：

```sh
npx --package hexo-cli hexo init milo-site
cd milo-site
npm install
```

在博客根目录安装主题及站点必需渲染器、生成器：

```sh
git clone https://github.com/tanwenhaodotcom/hexo-theme-milo.git themes/milo
npm install --prefix themes/milo --omit=dev
npm install hexo-renderer-ejs hexo-renderer-marked hexo-generator-index hexo-generator-archive hexo-generator-category hexo-generator-tag
```

将博客根目录 _config.yml 的 theme 改为 milo，按实际情况设置 title、author、url、root 和 language: zh-CN。主题界面主要为中文，尚未提供完整多语言翻译。

复制 themes/milo/_config.yml.example 为博客根目录 _config.milo.yml，不要覆盖博客的 _config.yml。主题的 hexo-util、image-size 仅用于构建；Disqus 是可选服务，Atom 不需另装插件。本主题不包含部署工具。

### 本地预览

在博客根目录执行，hexo-server 为本地预览所需插件（新建站点通常已有）：

```sh
npm install hexo-server
npx hexo clean
npx hexo generate
npx hexo server
```

访问终端显示的本地地址。子路径部署须正确设置 url/root；修改主题配置后重启服务。

## 配置与内容

主题默认配置见 _config.yml。博客标题、作者、网址、语言、分页仍使用 Hexo 原生站点配置。主题没有打包个人文章、头像、域名、后台或部署凭据。

将 themes/milo/examples/pages/ 中的四个页面示例分别复制到 source/search/index.md、source/tags/index.md、source/categories/index.md 和 source/about/index.md（先创建目录）。保留对应 layout，关于页正文自行填写；about/index.html 也会识别为关于页。

文章可使用 cover 或 thumbnail、toc: false、comments: false。目录由 Markdown 标题自动生成。总字数按中文字符和英文单词计算，不含 HTML 标记与标点。

### 首页封面与正文截图

首页仅使用文章 Front Matter 的 `cover`，未设置时使用 `thumbnail`；不会自动提取正文首图。正文 Markdown/HTML 图片只显示在正文中，设置封面也不会自动插入正文。

`cover_fit` 仅接受 `cover`（默认，摄影图片填满封面区域，可能裁剪）和 `contain`（截图完整等比显示，允许留白）。缺省或其他值均回退 `cover`。首页封面在所有屏幕宽度统一使用 16:10 区域；800px 及以下仍按元信息、全宽标题、封面、摘要单栏排列，不再限制封面最大高度。两种模式使用相同占位尺寸；contain 自动添加克制的边界、圆角和轻微阴影，适配深浅色。

```yaml
---
title: 界面截图
cover: /images/screenshot.png # 或 thumbnail，二者同时设置时 cover 优先
cover_fit: contain
---
```

正文截图按需使用 HTML，尺寸填写图片真实像素值；普通摄影图片无需添加 class。图片内容不会被主题修改。

```html
<img src="/images/screenshot.png" class="milo-screenshot" width="1200" height="800" alt="界面说明">
```

站点本地图片路径可由主题在构建时适配 /demo/；部署时仍需正确配置站点 url/root。加载失败时封面保留原有占位，不会自动换图。

search.enable 关闭时隐藏搜索入口且不生成 search.json。comment.disqus.shortname 留空关闭评论；启用后需要读者主动点击才连接 Disqus。footer.custom_text 允许受信任的 HTML，不用于不可信访客输入。

支持部署到 GitHub Pages 的子路径站点；站点 url 与 root 需按 Hexo 要求配置。此仓库只提供主题，hexo-admin 等后台属于博客自己的依赖。

## 开发

layout/ 存放 EJS 模板；scripts/milo.js 提供构建期 helper、SEO、搜索、Atom、图片尺寸和 404 处理；source/css/milo.css 为独立样式；source/js/milo.js 为浏览器交互。没有前端编译步骤；主题构建期依赖见 package.json。

项目仓库：https://github.com/tanwenhaodotcom/hexo-theme-milo

## 许可证

采用 [MIT 许可证](LICENSE)，保留英文法律文本及版权声明。

## SEO 与订阅

自动生成页面标题、描述、Open Graph 和 Twitter Card；文章描述优先使用 Markdown 的 more 分隔符之前的摘要，其次为文章 description、正文。分享图片依次使用 cover、thumbnail、主题 seo.image、img.avatar 和内置默认 PNG。可在站点 _config.milo.yml 中设置 seo.image，支持站内路径或完整 HTTP(S) URL。图片应使用适合分享卡片的横向尺寸；配置头像时建议另外提供横向 seo.image。

默认生成 atom.xml（最近 20 篇文章）并添加 Feed 自动发现。主题 feed.enable: false 可关闭；feed.limit 可设置正整数篇数。已有名为 feed 的生成器（例如站点安装 hexo-generator-feed）时，主题不再生成 Atom，自动发现使用站点 feed.path（字符串或数组，默认 atom.xml）。站点 feed: false 或 feed.enable: false 也会关闭主题订阅输出。

## 阅读体验

文章页提供桌面章节高亮、手机端原生折叠目录、正文阅读进度及代码复制。800px 及以下的阅读进度为紧贴吸顶导航下缘的 3px 细条，不显示百分比；位置复用导航实际尺寸测量，桌面进度组件保持不变。代码复制保留缩进与换行，不包含高亮行号；浏览器不允许复制时会提示手动选择。

正文图片保留作者已有的加载方式和尺寸。主题通过构建期 image-size 读取站点 source、主题 source 或文章资源目录中的图片元数据，自动补齐缺失的 width/height；只读前 256 KiB 并缓存结果，不处理图片内容，也不抓取远程图片。缺失、损坏或无法识别的图片不阻断构建。未知尺寸图片仍按临时比例占位；远程图片、复杂响应式图片请显式填写真实宽高，以减少 CLS。

靠前的正文首图及列表第一篇的封面优先加载，其余图片默认懒加载；显式 loading、fetchpriority、decoding 设置优先。reading.js 只在有目录、代码块或已启用灯箱图片的正文页加载。复制 API 被拒绝时会继续尝试传统复制，并恢复焦点和文本选区；两种方式均失败时提示手动选择。

可在站点 _config.milo.yml 设置 reading.lightbox: true 启用原生灯箱（默认关闭）；文章 front matter 的 lightbox: false 或图片 data-no-lightbox 可单独禁用。已有图片链接保持原行为。支持键盘 Enter/空格打开、Tab/Shift+Tab 保持在弹窗内、Escape 或关闭按钮退出，并恢复图片焦点；不支持原生 dialog 的浏览器保留普通图片。

## 分页与 404

建议在博客根目录的 _config.yml 设置 per_page: 6，自定义时改为所需正整数。若配置了 index_generator.per_page，它会覆盖首页的全局设置；删除该覆盖项即可沿用 per_page，或同步设置为同一个值。归档、分类、标签可分别使用 archive_generator.per_page、category_generator.per_page、tag_generator.per_page；归档单页展示可设置 archive_generator.per_page: 0。主题不会截断文章列表或写死每页数量。修改站点配置后请重启 Hexo Server。

主题自动生成 public/404.html，沿用站点导航、页脚及深浅色外观，无需手动创建 Markdown 页面。已有 source/404.html 或生成路径为 404.html 的站点页面优先保留。部署时由托管平台将未匹配 URL 交给 404.html 并返回 HTTP 404；子目录站点按平台规则配置到对应的 /demo/404.html。

## 页面细节与浏览器回归

首页摘要中的连续长词会自动换行，分页数量仍由 Hexo 配置决定。404 沿用站点容器宽度，采用左对齐的小标识、友好标题和首页/搜索按钮；关闭 search.enable 时不显示搜索按钮。

搜索结果的标题和可见摘要会标记查询词，支持中文、英文、重复匹配及按空白分隔的多个高亮词。高亮只改变展示，不改变原有整串查询过滤、结果顺序或索引；正则特殊字符按字面处理，内容通过 DOM 文本节点和 mark 元素生成。

开发依赖、回归命令和浏览器夹具要求见 [验证说明](VERIFICATION.md)。普通用户无需安装 jsdom 或运行主题测试。

## 桌面粘性侧栏

默认 sidebar.sticky: true。仅最近文章和分类组成的区域使用原生 CSS sticky；作者卡片自然滚出视野。双栏布局（宽度大于 800px）启用，当前导航高 65px，吸附区在其下方保留 24px；区域受父容器底部限制，内容超过可用视口高度时可在区内滚动。短页面没有足够滚动空间时，不会强行悬浮到 Footer。手机端保留现有布局，不启用粘性；文章目录不受影响。

在站点 _config.milo.yml 中设置以下内容可关闭：

```yaml
sidebar:
  sticky: false
```

配置修改后重启 Hexo Server。侧栏宽度、作者卡片及模块间距保持不变，不使用 fixed、滚动监听或额外依赖。

可在保持预览运行时设置 MILO_TEST_SIDEBAR_ONLY=1，再执行 npm run test:browser 单独复验侧栏；完整浏览器测试也包含该回归。测试覆盖桌面、双栏平板、手机、深浅色、父容器边界和关闭开关。

## 配置速查

在博客根目录 _config.milo.yml 覆盖所需值，完整默认值见 [_config.yml](_config.yml)。

| 配置键 | 用途 |
| --- | --- |
| uiux.slogan | 作者卡片和关于页简介，可用字符串或数组 |
| uiux.primary_color / link_color / bg_color | 按钮、链接和背景颜色 |
| img.avatar / head.favicon.ico | 自备头像和图标路径，留空不显示 |
| footer.custom_text / copyright_since | 受信任的页脚 HTML / 起始年份，0 使用当前年份 |
| search.enable / toc.enable | 搜索 / 目录开关 |
| comment.disqus.shortname | Disqus 站点标识，留空关闭 |
| seo.image | 分享图片路径或 HTTP(S) URL |
| feed.enable / limit | 内置 Atom 开关 / 正整数篇数 |
| reading.lightbox | 图片灯箱，默认关闭 |
| sidebar.sticky | 桌面侧栏吸附，默认开启 |

标题、作者、域名使用 Hexo 站点配置；关于页正文可加入个人介绍和社交链接，主题没有专门的社交链接配置键。图片路径必须对应自行添加的资源，示例不附带头像或私人截图。

## 更新与卸载

更新前备份配置及主题内自行修改的文件。在博客根目录执行：

```sh
git -C themes/milo pull --ff-only
npm install --prefix themes/milo --omit=dev
npx hexo clean
npx hexo generate
```

此方式跟随默认分支，可能包含未发布修改；需要固定版本时先阅读对应 Release，再选择标签。直接修改主题的用户须先处理自己的改动，不要强制覆盖。

卸载时先将站点 theme 改为已安装的其他主题，再删除 themes/milo，按需移除 _config.milo.yml，然后 clean 和 generate。文章与站点依赖独立保留。

## 常见问题

- 无样式或子路径链接错误：检查站点 url/root，清理旧生成文件后重建。
- 搜索、分类、标签或关于页缺失：按上述路径复制示例并检查 layout；关闭搜索不生成索引。
- 头像或封面缺失：添加实际图片并检查路径；正文首图不会自动成为封面。
- 配置未生效：区分站点配置与主题覆盖配置，重启 Hexo Server；更换分页策略后 clean。
- 线上未使用 404：由托管平台配置未知路径及 HTTP 404 状态。

## 开发方式与贡献说明

Milo 是一个由项目维护者主导设计与需求，主要使用 OpenAI Codex 完成代码编写、调试、测试和构建的 Hexo 主题。项目维护者负责功能规划、设计决策、验收与版本发布，并承担项目维护责任。

本项目不是 OpenAI 官方开发、认证或担保的产品，Codex 不独立运营或维护本项目。

欢迎通过仓库 Issues 或 Pull Request 参与，详见 [贡献指南](CONTRIBUTING.md)。请勿在公开反馈中上传凭据或私人文章。
