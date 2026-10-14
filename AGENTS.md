# Repository instructions

## 核心原则

- 优先核对并复用适用的原生 CSS；仅为缺口增加自有根内的最小适配，并向用户说明。
- metadata 与版本变更逐字段人工批准，开发依赖变更事先批准。
- Issue 默认只读；仅在明确请求或相关技能授权具体动作时写入。
- 提交采用 Conventional Commits；提交前在最终变更状态运行 `npm run check`，修改后重跑。
- 文档仅记录当前有用且难以从代码直接获得的约定、理由和陷阱；细则单处维护。

## 工作前读取

- 探索代码或修改领域文档：读取 [领域指南](docs/agents/domain.md)。
- 实施、测试、构建或交付：读取 [开发与交付](docs/development.md)。
- 修改宿主接管、格纳库解析、启停请求或站点样式：另读 [Bangumi 外部事实](docs/external/bangumi.md)。
- 修改 userscript metadata、项目版本或开发依赖：读取 [人工治理](docs/agents/metadata.md)。
- 操作 issue：读取 [tracker 指南](docs/agents/issue-tracker.md)；分类或改标签时另读 [triage 映射](docs/agents/triage-labels.md)。

## 维护入口

`src/index.user.js` 是生成物；修改维护源后单独构建，避免默认加载整个产物。维护边界见 [维护源导航](docs/module-guide.md)，行为约束见 [规格](docs/spec.md)；具体命令从 package scripts 定位。
