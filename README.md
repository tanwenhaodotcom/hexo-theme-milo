# Milo

当前版本：**0.2.0**（待发布）。

An independent Hexo theme built with EJS, native CSS and JavaScript. No frontend framework or browser runtime dependencies; small utilities run at build time.

## 功能

- 简洁双栏布局、手机适配、浅色/深色/跟随系统
- 右上角搜索入口，本地全文索引仅搜索时加载
- 文章目录吸顶、平滑跳转和当前章节跟踪
- 年度归档、分类与标签、独立关于页
- 作者资料和字数统计，Disqus 按需加载
- 原生系统字体、内联 SVG 图标，无外部字体或前端框架

## 安装

已验证 Node.js 26.13.0 / Hexo 8.1.2。主题声明 Node.js >=18，但 Hexo 8.1.2 自身要求 Node.js >=20.19；实际环境须同时满足 Hexo 的要求。本轮未验证 Hexo 7 或 Node.js 18。站点需安装 hexo-renderer-ejs、hexo-renderer-marked、hexo-generator-index、hexo-generator-archive、hexo-generator-category、hexo-generator-tag。

1. 在博客根目录执行：`git clone https://github.com/tanwenhaodotcom/hexo-theme-milo.git themes/milo`，然后执行 `npm install --prefix themes/milo --omit=dev` 安装主题的构建期依赖。
2. 站点 _config.yml 设置 theme: milo。
3. 从 _config.yml.example 复制必要选项到博客根目录 _config.milo.yml。
4. 执行 hexo clean 和 hexo generate；hexo server 本地预览。

## 配置与内容

主题默认配置见 _config.yml。博客标题、作者、网址、语言、分页仍使用 Hexo 原生站点配置。主题没有打包个人文章、头像、域名、后台或部署凭据。

静态页面请在 source 中创建 index.md，front matter 使用 layout: search、tags、categories 或 about。about/index.html 也会自动识别为关于页。

文章可使用 cover 或 thumbnail、toc: false、comments: false。目录由 Markdown 标题自动生成。总字数按中文字符和英文单词计算，不含 HTML 标记与标点。

search.enable 关闭时隐藏搜索入口且不生成 search.json。comment.disqus.shortname 留空关闭评论；启用后需要读者主动点击才连接 Disqus。footer.custom_text 允许受信任的 HTML，不用于不可信访客输入。

支持部署到 GitHub Pages 的子路径站点；站点 url 与 root 需按 Hexo 要求配置。此仓库只提供主题，hexo-admin 等后台属于博客自己的依赖。

## 开发

layout/ 存放 EJS 模板；scripts/milo.js 注册字数 helper 和搜索生成器；source/css/milo.css 为独立样式；source/js/milo.js 为浏览器交互。没有构建步骤或主题专属 npm 依赖。

项目仓库：https://github.com/tanwenhaodotcom/hexo-theme-milo

## License

MIT，见 LICENSE。

## SEO 与订阅

自动生成页面标题、描述、Open Graph 和 Twitter Card；文章描述优先使用 Markdown 的 more 分隔符之前的摘要，其次为文章 description、正文。分享图片依次使用 cover、thumbnail、主题 seo.image、img.avatar 和内置默认 PNG。可在站点 _config.milo.yml 中设置 seo.image，支持站内路径或完整 HTTP(S) URL。图片应使用适合分享卡片的横向尺寸；配置头像时建议另外提供横向 seo.image。

默认生成 atom.xml（最近 20 篇文章）并添加 Feed 自动发现。主题 feed.enable: false 可关闭；feed.limit 可设置正整数篇数。已有名为 feed 的生成器（例如站点安装 hexo-generator-feed）时，主题不再生成 Atom，自动发现使用站点 feed.path（字符串或数组，默认 atom.xml）。站点 feed: false 或 feed.enable: false 也会关闭主题订阅输出。

## 阅读体验

文章页提供桌面章节高亮、手机端原生折叠目录、正文阅读进度及代码复制。代码复制保留缩进与换行，不包含高亮行号；浏览器不允许复制时会提示手动选择。

正文图片保留作者已有的加载方式和尺寸。主题通过构建期 image-size 读取站点 source、主题 source 或文章资源目录中的图片元数据，自动补齐缺失的 width/height；只读前 256 KiB 并缓存结果，不处理图片内容，也不抓取远程图片。缺失、损坏或无法识别的图片不阻断构建。未知尺寸图片仍按临时比例占位；远程图片、复杂响应式图片请显式填写真实宽高，以减少 CLS。

靠前的正文首图及列表第一篇的封面优先加载，其余图片默认懒加载；显式 loading、fetchpriority、decoding 设置优先。reading.js 只在有目录、代码块或已启用灯箱图片的正文页加载。复制 API 被拒绝时会继续尝试传统复制，并恢复焦点和文本选区；两种方式均失败时提示手动选择。

可在站点 _config.milo.yml 设置 reading.lightbox: true 启用原生灯箱（默认关闭）；文章 front matter 的 lightbox: false 或图片 data-no-lightbox 可单独禁用。已有图片链接保持原行为。支持键盘 Enter/空格打开、Tab/Shift+Tab 保持在弹窗内、Escape 或关闭按钮退出，并恢复图片焦点；不支持原生 dialog 的浏览器保留普通图片。

## 分页与 404

建议在博客根目录的 _config.yml 设置 per_page: 6，自定义时改为所需正整数。若配置了 index_generator.per_page，它会覆盖首页的全局设置；删除该覆盖项即可沿用 per_page，或同步设置为同一个值。归档、分类、标签可分别使用 archive_generator.per_page、category_generator.per_page、tag_generator.per_page；归档单页展示可设置 archive_generator.per_page: 0。主题不会截断文章列表或写死每页数量。修改站点配置后请重启 Hexo Server。

主题自动生成 public/404.html，沿用站点导航、页脚及深浅色外观，无需手动创建 Markdown 页面。已有 source/404.html 或生成路径为 404.html 的站点页面优先保留。部署时由托管平台将未匹配 URL 交给 404.html 并返回 HTTP 404；子目录站点按平台规则配置到对应的 /demo/404.html。

## 页面细节与浏览器回归

首页摘要中的连续长词会自动换行，分页数量仍由 Hexo 配置决定。404 沿用站点容器宽度，采用左对齐的小标识、友好标题和首页/搜索按钮；关闭 search.enable 时不显示搜索按钮。

搜索结果的标题和可见摘要会标记查询词，支持中文、英文、重复匹配及按空白分隔的多个高亮词。高亮只改变展示，不改变原有整串查询过滤、结果顺序或索引；正则特殊字符按字面处理，内容通过 DOM 文本节点和 mark 元素生成。

保持独立预览运行后执行 npm run test:browser（Node.js 22+，已验证 Node.js 26），使用已安装的 Chrome/Edge 检查首页视口与滚动恢复、6+1 分页、404 和搜索。可用 MILO_BROWSER 指定浏览器、MILO_PREVIEW_URL 指定预览地址。设置 MILO_TEST_HMR=1 会临时追加并原样移除 CSS 注释，以验证热更新与滚动位置；MILO_SCREENSHOT_DIR 可指定截图目录。该浏览器测试不安装新依赖，也不会将浏览器滚动强制归零。

## 桌面粘性侧栏

默认 sidebar.sticky: true。仅最近文章和分类组成的区域使用原生 CSS sticky；作者卡片自然滚出视野。双栏布局（宽度大于 800px）启用，当前导航高 65px，吸附区在其下方保留 24px；区域受父容器底部限制，内容超过可用视口高度时可在区内滚动。短页面没有足够滚动空间时，不会强行悬浮到 Footer。手机端保留现有布局，不启用粘性；文章目录不受影响。

在站点 _config.milo.yml 中设置以下内容可关闭：

```yaml
sidebar:
  sticky: false
```

配置修改后重启 Hexo Server。侧栏宽度、作者卡片及模块间距保持不变，不使用 fixed、滚动监听或额外依赖。

可在保持预览运行时设置 MILO_TEST_SIDEBAR_ONLY=1，再执行 npm run test:browser 单独复验侧栏；完整浏览器测试也包含该回归。测试覆盖桌面、双栏平板、手机、深浅色、父容器边界和关闭开关。
