# Milo

A clean, independent Hexo theme written from scratch. No Suka templates, styles, scripts or runtime dependencies.

## 功能

- 简洁双栏布局、手机适配、浅色/深色/跟随系统
- 右上角搜索入口，本地全文索引仅搜索时加载
- 文章目录吸顶、平滑跳转和当前章节跟踪
- 年度归档、分类与标签、独立关于页
- 作者资料和字数统计，Disqus 按需加载
- 原生系统字体、内联 SVG 图标，无外部字体或前端框架

## 安装

需要 Node.js 18+、Hexo 7/8，以及站点已安装 hexo-renderer-ejs、hexo-renderer-marked、hexo-generator-index、hexo-generator-archive、hexo-generator-category、hexo-generator-tag。

1. 把本仓库放到博客 themes/milo 目录。
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

此项目尚未上传 GitHub，安装地址在仓库建立后补充。

## License

MIT，见 LICENSE。
