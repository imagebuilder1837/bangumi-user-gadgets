# Triage 标签

技能使用以下五种标准角色，名称直接映射到本仓库标签：

| 技能角色          | Tracker 标签      | 含义                      |
| ----------------- | ----------------- | ------------------------- |
| `needs-triage`    | `needs-triage`    | 等待维护者评估            |
| `needs-info`      | `needs-info`      | 等待补充信息              |
| `ready-for-agent` | `ready-for-agent` | 规格充分，可供 agent 接手 |
| `ready-for-human` | `ready-for-human` | 需要人工实施              |
| `wontfix`         | `wontfix`         | 不实施                    |

ready 表示规格成熟，不替代人工执行授权，也不解除阻塞项；执行边界见 [开发指南](../development.md)。

表格是角色映射，不声明五个标签都已在 GitHub 创建。分类前核对实际标签；缺失标签的创建按 [tracker 权限](issue-tracker.md) 处理，不静默以其他标签代替。
