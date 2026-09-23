# opencode-activity-panel

OpenCode V2 的 **CLI 插件**：在右侧栏显示当前会话的「任务目标 / 当前动作 / 计划步骤」，随时知道 opencode 在做什么、走到哪一步了。

**零 prompt 影响**：不注册工具、不加 hook、不注入系统提示词、不改历史。只读服务端事件流 + 本地消息缓存，因此不消耗 token，也不影响 prompt 缓存命中。

## 显示内容

| 区块 | 数据来源 | 准确性 |
|---|---|---|
| 任务 | 会话标题 + 最近一条用户消息 | 准确 |
| 当前动作 | `session.*` 事件流（思考 / 生成回复 / 工具调用 + 计时） | 准确 |
| 计划 | 助手文本里的编号 / 复选框列表解析 | 启发式（解析不到就不显示） |

计划标题会如实说明来源，不做过度承诺：

| 标题 | 含义 |
|---|---|
| `计划 2/5` | 计划用勾选语法（`[ ]`/`[x]`/`✅`），进度可信，当前步骤标 `[>]` |
| `计划` | 普通编号列表且来自最新助手消息，不标"当前步骤" |
| `计划（可能过时）` | 普通编号列表，但之后已有更新的助手消息（模型不会回来打勾） |
| `计划（上次）` | 消息缓存里已找不到来源（如压缩），显示上次持久化的快照 |

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
  parse/plan.ts         计划文本解析（纯函数，有缓存）
  state/activity.ts     活动状态机（纯 reducer）
  state/hydrate.ts      TUI 重启后从消息缓存恢复运行中的动作
  util/events.ts        服务端事件 -> 内部事件映射
  util/summarize.ts     工具入参摘要
  util/text.ts          截断 / 单行化 / 耗时格式化
  ui/                   sidebar.content 的四个渲染组件
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
