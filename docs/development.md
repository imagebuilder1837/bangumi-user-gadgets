# 开发约定

测试优先从显式应用入口观察用户行为，只在已有公开契约下使用更低 seam；浏览器依赖可替换，内部 helper 保持私有。

提交前运行只读交付检查；格式或产物过期应单独修复后重查。JavaScript 使用语法检查与 IDE diagnostics，本项目没有 TypeScript 类型检查器。构建与检查通过不授权发布或真实启停。

浏览器验收使用现有 Edge；jsdom 不证明几何、原生事件循环或真实焦点细节。真实响应 fixture 须裁剪、替换用户信息与动作令牌，不保存登录态整页。

规格在 GitHub Issues 维护，领域术语在 CONTEXT.md；外部结构事实见 external/bangumi.md。
