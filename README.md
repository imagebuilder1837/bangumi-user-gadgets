# Bangumi 用户组件

[安装脚本](https://raw.githubusercontent.com/imagebuilder1837/bangumi-user-gadgets/refs/heads/main/src/index.user.js)（需要 userscript 管理器）。

在受支持的 Bangumi 个人页或收藏页，点击“小组”右侧的“组件”，浏览该作者在当前格纳库中可匹配的作品。也可直接打开 `#gadgets`；浏览器前进后退可返回原页面。

当前版本只读，不提供启停、搜索、筛选或排序控件。身份按作者链接精确匹配，用户名与数字 UID 不归并；私有、下架或格纳库未展示的作品不在承诺范围内。同一文档重入复用读取结果，刷新整个页面才重新读取成功数据。

开发约定见 [docs/development.md](docs/development.md)，外部契约与浏览器验收边界见 [docs/external/bangumi.md](docs/external/bangumi.md)。
