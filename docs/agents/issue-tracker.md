# Issue tracker: GitHub

本仓库的 issue 与 spec 使用 GitHub Issues，通过 `gh` CLI 操作。
在仓库目录执行命令，仓库归属从 git remote 推断。

## 技能操作约定

- “发布到 issue tracker”：创建 GitHub issue。
- “获取相关 ticket”：运行 `gh issue view <number> --comments`，并读取标签。
- 多行正文使用 `--body-file`，通过文件或标准输入传入。

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub 的 issue 与 PR 共用编号；遇到含糊的编号时先确认对象类型。
