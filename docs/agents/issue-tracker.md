# Issue tracker：GitHub

本仓库的 spec 与 tickets 使用 GitHub Issues，通过 `gh` 操作；在仓库内从 git remote 确认目标仓库，避免写入参考项目。

## 权限

Issue 默认只读。仅在用户明确要求或相关技能授权具体动作时，才可创建、编辑、评论、改标签、指派或关闭。授权拆票不等于授权修改／关闭父 spec；执行实现也不隐含授权写 issue。

任务状态标签及其语义见 [triage 映射](triage-labels.md)。实施与交付授权见 [开发指南](../development.md)。

## 读取与发布

- 读取相关 ticket：`gh issue view <number> --json number,title,body,comments,labels,state,url`；同时读取父 spec、适用评论和阻塞项。
- 技能要求发布到 tracker 时，创建 GitHub issue；多行正文先保存为 UTF-8 文件，再用 `--body-file`，避免 shell 转义破坏正文。
- 票面引用父 spec，并写可独立验证的交付与验收，不把代码目录／私有 helper 当实现要求。
- 获授权的写操作完成后回读，核对正文、标签、URL 及所请求的关系；部分失败按已完成／未完成分别报告。

## 阻塞关系

GitHub 原生 issue dependencies 是阻塞关系的权威来源。读取：

`gh api repos/<owner>/<repo>/issues/<number>/dependencies/blocked_by`

获授权后添加：

`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`

这里使用阻塞 issue 的数字数据库 `id`，不是票号或 `node_id`。票面“Blocked by”便于人阅读，应与原生关系一致；依赖未完成时，不仅凭 ready 标签认定可执行。只有接口不支持原生关系时才回退票面引用，并报告限制。

父 spec 引用、GitHub sub-issue 与阻塞是不同关系；不因正文引用父 spec 就自动修改父 issue 或创建 sub-issue 关系。

## Triage surface

**PRs as a request surface: no.** PR 不默认作为功能请求参与 triage。GitHub issue 与 PR 共用编号空间，遇到不明引用先确认对象类型。
