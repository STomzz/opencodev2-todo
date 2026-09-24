# opencode-activity-panel

OpenCode V2 的 **CLI 插件**：在右侧栏显示当前会话的「任务目标 / 当前动作 / 待办或计划」，随时知道 opencode 在做什么、走到哪一步了。

**零 prompt 影响**：不注册工具、不加 hook、不注入系统提示词、不改历史。只读服务端事件流 + 本地消息缓存，因此不消耗 token，也不影响 prompt 缓存命中。

## 显示内容

| 区块 | 数据来源 | 准确性 |
|---|---|---|
| 任务 | 会话标题 + 最近一条用户消息 | 准确 |
| 当前动作 | `session.*` 事件流（思考 / 生成回复 / 工具调用 + 计时） | 准确 |
| 待办 / 计划 | ① 模型自己的 `todowrite` 待办（首选）② 助手文本里**看起来像计划**的列表（回退，有门槛） | ① 真实状态，会随执行走动 ② 启发式（误报宁愿不显示） |

计划标题会如实说明来源，不做过度承诺：

| 标题 | 含义 |
|---|---|
| `待办 2/5` | 来自模型的 `todowrite` 工具：状态真实，当前步骤标 `[>]`，勾会随执行打上 |
| `计划 2/5` | 文本启发式：计划里带勾选语法（`[ ]`/`[x]`/`✅`），进度取决于模型是否回写 |
| `计划` | 普通编号列表且来自最新助手消息，不标"当前步骤" |
| `计划（可能过时）` | 普通编号列表，但之后已有更新的助手消息（还没到自动隐藏的程度） |

计划不会"常驻"：

- **文本回退有门槛**：普通编号列表必须满足其一才显示——带勾选语法、引导句是计划口吻（如「计划如下：」「## 实施步骤」「待办：」）、或来自 plan 模式的消息。进度汇报、选项清单这类"长得像列表但不是计划"的内容不再冒充计划；
- **旧任务自动隐藏**：非勾选型文本计划，如果它之后又出现了 ≥2 条新的用户消息，说明已经换任务了，整块不再显示（`todowrite` 待办不适用，它是模型的权威状态）;
- **完成即收起**：全部打勾后只保留标题（如 `待办 5/5`），不再逐条列出；
- **手动隐藏**：点击计划标题（`[隐藏]`）即可收起本计划；同一会话出现新计划时自动恢复显示；
- **不做持久化回显**：消息被压缩或任务中断后计划也随之消失，不会"复活"。

当会话显示 `running` 但长时间收不到已识别事件时，「当前动作」会显示 `? 运行中（未识别事件）` —— 这是 OpenCode 升级导致事件名变化的信号，而不是模型卡住。

## 安装

插件加载走 `~/.config/opencode/cli.json`（CLI-only 插件，连远程 server 时也生效）：

```jsonc
{
  "plugins": [
    {
      "package": "/path/to/opencode-activity-panel",
      "options": { "maxChars": 28 }
    }
  ]
}
```

`package` 要填本插件目录的**绝对路径**（例如把仓库 clone 到 `~/opencode-activity-panel` 后填 `~/opencode-activity-panel`）。

改完后新开 TUI（或按 opencode 的配置热重载）即可生效。

## 选项

| 选项 | 默认值 | 说明 |
|---|---|---|
| `maxChars` | `0` | 动作 / 计划行宽上限；`0` = 不限（自动换行） |
| `goalChars` | `0` | 任务标题 / 用户请求宽度上限；`0` = 不限（自动换行） |
| `collapseChars` | `56` | 超过该长度的行默认折叠成一行，**点击展开/收起**；`0` = 从不折叠 |
| `maxPlanItems` | `12` | 计划最多显示条数 |
| `planSource` | `"todo+text"` | `todo+text` = 真待办优先、没有则文本回退；`todo` = **只看真待办**（文本计划一律不显示，最干净） |
| `showGoal` / `showAction` / `showPlan` | `true` | 按区块开关 |
| `debug` | `false` | 加载时弹 toast，用于确认插件已生效 |

计划标记：`[ ]` 待办、`[>]` 当前步骤、`[✓]` 已完成。折叠的单行末尾有 `…`，点击该行即展开（展开后按侧栏宽度换行），再点收起。

## 开发

```sh
npm install
npm run typecheck   # tsc --noEmit
npm test            # node --test（Node 22 直接跑 .ts，无需框架）
```

目录结构：

```
tui.tsx                 入口薄壳（exports["./tui"] 与目录直读两种解析模式都命中）
src/
  plugin.tsx            Plugin.define：事件订阅、状态容器、slot 注册
  options.ts            选项解析
  types.ts              共享类型（纯数据）
  parse/todos.ts        真实待办提取（todowrite 工具 part，纯函数）
  parse/plan.ts         计划文本解析（纯函数，有缓存）
  state/activity.ts     活动状态机（纯 reducer）
  state/hydrate.ts      TUI 重启后从消息缓存恢复运行中的动作
  util/events.ts        服务端事件 -> 内部事件映射
  util/summarize.ts     工具入参摘要
  util/text.ts          截断 / 单行化 / 耗时格式化
  ui/                   sidebar.content 的渲染组件（含 `heading.tsx` 栏目标题）
test/                   纯逻辑单测（node --test）
docs/dev-notes.md       加载方式、事件表、踩坑记录
```

分层约定：能测的逻辑全在纯 `.ts`（不 import solid / opentui），`.tsx` 只做接线和展示。

## 调试

- 日志：`~/.local/share/opencode/log/opencode.log`（`OPENCODE_LOG_LEVEL=DEBUG` 更详细）
- 面板不显示时先确认侧栏已展开（默认 `<leader>b` 切换）
- 事件字段可对照 `docs/dev-notes.md` 里的映射表

## 卸载

从 `~/.config/opencode/cli.json` 的 `plugins` 数组中移除本条目即可；目录本身不会自动删除。

## 协议

[MIT](./LICENSE) © 2026 STomzz
