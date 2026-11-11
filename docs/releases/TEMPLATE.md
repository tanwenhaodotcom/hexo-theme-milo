# 中文发布说明模板

- README 面向初次使用 Milo 的用户。只同步实际变化的功能、用法、兼容性及发布信息，详细改动放在 CHANGELOG。
- CHANGELOG 使用 `vX.Y.Z — YYYY-MM-DD（预发布）` 或 `vX.Y.Z — YYYY-MM-DD（正式版）`。发布前标明草案和日期待定，发布时填写实际日期。
- GitHub Release 标题使用 `Milo vX.Y.Z（预发布）` 或 `Milo vX.Y.Z（正式版）`，状态应与 GitHub 上的发布选项一致。
- 两份说明共用前六个小节。Release 每条尽量一句话，只保留读者能感受到的变化，下载与更新链接放在最后。
- 用简体中文说明变化和操作，保留必要的技术名称、命令及配置字段。某类没有改动时直接说明。记录实际验证的环境和未验证的范围，隔离实验只在需要说明范围时提及。
- 发布时核对版本号、标题、标签、下载入口和安装说明。Release 正文使用绝对链接。

## 可复制正文

```markdown
## 本次重点

用一两句话说明这版对读者最重要的变化。

## 新增

本次无新增功能。

## 优化

本次无单独记录的优化。

## 修复

本次无单独记录的修复。

## 使用提醒

本次无单独记录的使用提醒。

## 兼容性与验证

填写实际验证的 Node.js、Hexo、浏览器或部署场景，以及已知限制。

## 下载与更新链接

- [版本下载](https://github.com/twhao/hexo-theme-milo/releases)
- [安装说明](https://github.com/twhao/hexo-theme-milo#安装与启用)
- [更新说明](https://github.com/twhao/hexo-theme-milo#更新与卸载)
- [完整更新记录](https://github.com/twhao/hexo-theme-milo/blob/main/CHANGELOG.md)
```
