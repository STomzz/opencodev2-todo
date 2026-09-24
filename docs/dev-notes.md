# 开发笔记

## 加载方式

- 插件通过 `~/.config/opencode/cli.json` 的 `plugins` 数组加载（CLI-only，连远程 server 也生效）。
- 入口解析在 2.0.11 二进制里有两种模式：
  - 目录有 `package.json` 且带 `name`：按 `<name>/tui` 走 `exports`；
  - 否则：在目录里找 `tui.*` 文件。
- 因此入口放在**包根目录** `tui.tsx`，同时 `exports["./tui"] = "./tui.tsx"`，两种模式都命中同一文件。
- 兜底：若 cli.json 对本地目录解析不顺，把目录软链到 `~/.config/opencode/plugins/activity-panel` 走自动发现。
- 同一个包目录还有**服务端插件**入口（根导出 `"."` → `index.ts`），由 `~/.config/opencode/opencode.json(c)` 的 `plugins` 加载，用于注册 V2 版 `todowrite`；CLI 侧只认 `./tui`，互不干扰。

## 事件映射（session 活动）

| 服务端事件 | 内部事件 | 面板效果 |
|---|---|---|
| `session.execution.started` | `execution.started` | 重置步骤计数，进入「思考中」 |
| `session.step.started` | `step.started` | 步骤 +1，进入「思考中」 |
| `session.reasoning.started/ended` | 同左 | 思考中（结束不切换，等下一个事件） |
| `session.text.started/ended` | 同左 | 「生成回复」 |
| `session.tool.input.started` | `tool.started` | 进入工具态，记录 id→name |
| `session.tool.called` | `tool.called` | 用入参摘要显示「运行: npm test」 |
| `session.tool.success/failed` | `tool.ended` | 记录「上一步」与耗时，回到思考中 |
| `session.execution.succeeded/failed/interrupted`、`session.idle` | 结束 | 空闲 |

注意：`session.tool.called` 不带工具名，必须用 `id` 关联 `session.tool.input.started`。

计时从 `session.tool.input.started` 起算，与面板显示的秒表一致。

## 真实待办（`src/parse/todos.ts`，首选数据源）

- V2 构建本身**不带** `todowrite`（2026-09 实测：调用报 `No tool named "todowrite" is currently available`，二进制里无该字符串，官方 Tools 文档也没有）；本仓库服务端插件（`index.ts`）把 V1 的它注册回来，面板只读不注入。模型每次调用带**完整清单**：
  `{ todos: [{ content, status: "pending" | "in_progress" | "completed" | "cancelled", priority }] }`
- v2 消息里的 tool part 形状：`{ type: "tool", id, name, state: { status, input, content, metadata }, time }`
  （注意是 `name`，不是 `state.input` 之外还有 `tool` 字段；v1 的 `part` 表用 `tool` 字段，两者都别混）
- 提取规则：从最新消息往前找第一条带 `todowrite` part 且 `input` 可解析的消息，取该消息里最后一个 `todowrite` part（同一消息可能有多次调用）→ 这就是当前权威清单
- `status === "completed"` → `[✓]`；`cancelled` → `[-]`（保持位置，但永远不当"当前"）；其余按 `in_progress` 优先标 `[>]`，没有则第一条未完成（跳过已取消）；标题 `待办 x/y`
- `source: "todo"` 的计划 `tracked` 恒为 true，因此不参与 `isSuperseded` 自动隐藏（只受手动 `[隐藏]` 影响）
- 面板优先级：`extractTodos() ?? extractPlan()`（有真待办就不看文本启发式）；`planSource: "todo"` 时直接跳过文本回退，宁可不显示

## V2 待办工具（服务端插件 `index.ts`）

- 背景：V2 没有 todo 工具 → 模型没有地方写真实进度、面板 `待办 x/y` 永远点不亮。方案是把 V1（`packages/opencode/src/tool/todo.ts` + `todowrite.txt`）原样搬回来。
- 注册：`Plugin.define({ id, setup })`（`@opencode/plugin` 的 promise 入口）→ `ctx.tool.transform((editor) => editor.add({...}))`；`input` 是普通 JSON Schema（V1 zod 的等价物），`execute` 返回 `{ content: JSON.stringify(todos, null, 2), metadata: { todos } }`（与 V1 输出一致）。
- **必须 `options: { codemode: false }`**：默认注册进的是 Code Mode 目录，模型只能在 `execute` 里 `tools.todowrite(...)`，消息里只留 `execute` 外壳——面板看不到。`codemode: false` 让它成为直连工具，调用落成顶层 `name: "todowrite"` part，面板零改动可用。
- 权限：`options.permission: "todowrite"` + 配置里 `{ "action": "todowrite", "resource": "*", "effect": "allow" }`，否则每次调用要确认。
- 语义与 V1 一致：整表替换、不增量；空数组 = 清空（面板会隐藏）。
- 验证：`opencode run --auto "请调用 todowrite…"` → 消息里应出现顶层 `todowrite` part；`extractTodos` 应返回 `source: "todo"`；日志里 `role=server` 的 plugin 加载无 warn。
- 取舍：模型可见工具面多一个工具（首次请求前缀变化、之后缓存照常命中）；描述文本每请求占少量 token。面板本身仍是零 prompt 影响。
- 描述文本在 `src/todo/description.ts`（V1 原文），schema/校验/格式化在 `src/todo/tool.ts`（纯函数，有单测）。

## 计划解析启发式（`src/parse/plan.ts`，回退数据源）

- 跳过 ``` / ~~~ 围栏代码块
- 强信号：编号（`1.` / `1)` / `1、`）、复选框（`- [x]`）、`✅ ☑ ✔ ✓ ⏳ 🔄 ▶ ☐ ⬜` 前缀
- 弱信号：普通 `- * + •` 列表，需连续 ≥3 条才认
- 一段「run」至少 2 条；同一消息里取**通过验收**的最长一段；同类消息优先 `agent === "plan"`
- **验收门槛**（2026-09-24 收紧，解决"汇报清单被当计划"）：一段 run 还必须满足其一——
  ① 带勾选/标记语法（`tracked`）；
  ② **引导句**是计划口吻（`PLAN_WORDS`：计划/步骤/待办/清单/下一步/流程/实施/路线/排期/plan/todo/checklist/step/roadmap… 且该行是标题、或以冒号结尾、或含"如下/以下"），
     只扫该 run 前的 3 行非空文本（"附近提到过计划"不算）；
  ③ 来源消息 `agent === "plan"`。
  普通`1. 2. 3.`式的进度汇报/选项清单不在以上之列 → 不再显示（宁缺毋滥；2026-09-24 用本仓库真实消息回放验证：11 条汇报/总结被拒，plan 消息与带引导句的计划保留）
- 解析结果按「消息 id + 文本长度 + djb2 摘要 + maxItems + 是否 plan agent」缓存，文本变化自动失效
- 解析不到 → 隐藏计划区块，不影响其余两块

### 诚实性规则（重要）

- `source`：`"todo"` = 模型 `todowrite` 的真实状态；`"text"` = 文本启发式。面板优先 todo。
- `tracked`：todo 恒为 true；文本计划里只要出现勾选语法（checkbox / ✅ / ☑ 等）就为 true。**只有 tracked 才显示 `[>]` 当前步骤和 `x/y` 进度**——普通编号列表模型不会回来打勾，标"当前步骤"在常见场景下是假信息。
- `currentIndex`：提取时就定好（todo：in_progress 优先；文本：第一条未完成，非 tracked 为 -1；两边都跳过 `cancelled`），UI 直接读，不再重算。
- `fromLatestAssistant`：来源消息是否为最新助手消息；普通编号列表 + 有更新消息 → 标题 `计划（可能过时）`。
- `userMessagesAfter` + `isSuperseded()`：非勾选文本计划在来源之后出现 ≥2 条新用户消息（`SUPERSEDED_USER_MESSAGES`）→ 整块隐藏，认为属于已过去的任务。
- `planVisible(plan, dismissedID)`：`isSuperseded` 或已被手动隐藏（按 messageID）→ 不渲染；新计划换 messageID，自动恢复。
- `planProgress()`：`complete` = tracked 且全部打勾 → 只渲染标题，不列条目。
- 不做持久化回显：计划只来自当前消息缓存，压缩/中断后消失即可。
- 不做"关键词匹配自动推进步骤"——误报比现状更糟；要真实进度就用 `todowrite`（由本仓库服务端插件提供，面板只读不注入）。

## 状态与重启恢复

- 活动状态放在 `context.storage.memory`（热重载共享、TUI 退出即丢），键为 `activity-state` / `activity-clock` / `activity-expanded` / `activity-dismissed`（短横线，不用冒号，原因见「坑」）。
- 面板不写任何 durable 存储：计划只来自消息缓存，压缩/中断后消失是预期行为（早前的快照回显方案已移除，`src/storage.ts` 只保留 guarded memory 包装）。
- 1s 定时器只更新 `clock.now`，用于秒表与存活判断。
- `showUnknownHint()`：会话 running 但活动为 idle 且超过 8s 没收到已识别事件 → 显示 `? 运行中（未识别事件）`（升级自检）。
- TUI 重启后：面板挂载时调 `data.session.message.sync(sessionID)`，从最新助手消息里找 `status === "running" | "streaming"` 的工具 part 恢复当前动作（`src/state/hydrate.ts`）。

## 热重载（实测 2026-09-23）

- `cli.json` 变更 → 自动 reconcil（插件数 12 → 13，无报错）。
- 插件源码目录变更（`touch` / 编辑 `tui.tsx`、`src/plugin.tsx`）→ 约 0.1~0.2s 后自动 reconcil，加载新代码。
- 结论：改代码 → 存盘即生效，开发期**不需要重启 TUI**。
- 验证加载：`options.debug: true` 时 setup 会弹一个 toast 作为「已加载」确认（`console.log` 不会进日志文件）。
- 加载证据：`~/.local/share/opencode/log/opencode.log` 里 `plugin reconciliation completed ... plugins=13 role=cli`，无 error/warn。

## 渲染约定

- 栏目标题统一为 ` o 标签`（`src/ui/heading.tsx`，`SECTION_MARK = " o "`，两侧各一个空格）——纯 ASCII，避免终端字体缺字；之前裸标题会和下面正式内容糊在一起。
- 计划标题行形如 ` o 计划 2/6  [隐藏]`，整行可点（`onMouseDown` → `dismissed[sessionID] = messageID`）；勾选型计划全部完成时只渲染标题行。
- 计划标记：`[ ]` 待办 / `[>]` 当前 / `[✓]` 已完成 / `[-]` 已取消（不用 ☐☑ 等字形，避免终端字体缺字显示成方框）。
- 长文本（> `collapseChars`，默认 56）默认**折叠成一行**：字符级截断加 `…`，同时 `height=1` + `overflow="hidden"` 保证即使侧栏更窄也只占一行。
- **点击折叠行切换展开/收起**：状态存在 `context.storage.memory("activity-expanded")` 里，数据键为 `<sessionID>:<区块>:...`（计划条目含 messageID 与序号，换消息后自动失效）。
  - 判断逻辑抽在纯函数 `src/util/collapse.ts`（有单测）；**展开后仍然保留点击处理**，所以同一行点一下展开、再点收起。
  - OpenTUI 的鼠标事件从命中的 renderable 向上冒泡（`Renderable.processMouseEvent`），所以 `<text onMouseDown>` 能收到点击。
  - 展开后 `height="auto"`、`overflow="visible"`，文本按侧栏宽度换行。
- `maxChars`/`goalChars` 为 0 时展开后完全显示；设为正数则即使展开也单行截断。

## 已知局限（2026-09-23 评估后保留的）

- 计划是**文本快照**，不是权威 todo：模型不回来打勾时（普通编号列表），面板只显示列表并标 `(可能过时)`，且换任务（≥2 条新用户消息）后整块隐藏，不假装知道当前步骤；严格逐项推进用服务端插件注册的 `todowrite`（见上文，模型可见面会变，已按需开启）。
- 任务目标 = 会话标题 + 最新用户消息，多轮长任务的早期约束会缺失。
- 重启恢复只能覆盖"正在运行的工具"；若重启发生在模型思考/生成回复期间，会短暂显示空闲，直到下一个事件。
- 冷门工具的摘要可能为空（只显示工具名）；耗时为 started→ended 墙钟，含排队/权限等待。
- 跨会话总览、本轮轨迹未做（按需求砍掉）。
- 侧栏宽度不可知：折叠行用 `height=1` + `overflow="hidden"` 裁剪成一行；展开靠 `wrapMode="word"` 自动换行。

## 坑 / 注意事项

- **storage 键不能含冒号**：段名规则是 `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`，且拒绝 `.` / `..`。`context.storage.store("activity:plan", …)` 会在 **setup 阶段直接抛错**，宿主记 `plugin operation failed ... stage=setup`，整个插件不加载（面板消失）。所有 store 现在都走 `src/storage.ts` 的 guarded 包装：memory 被拒就退 inert，保证 setup 永不因存储失败而挂掉。
  - 排查手法：`grep "activity-panel" ~/.local/share/opencode/log/opencode.log | grep WARN`；点开看 `stage=setup` 后面的 error 文案。
- 不用 durable 存储了，但留个档：`context.storage.store` 落盘在 `~/.local/state/opencode/<channel>/tui/plugin.<插件id>.<键>.json`，每次 mutation 加文件锁整写，`fs.watch` 在多 TUI 实例间同步；值必须是 **JSON 兼容的普通对象**。早前的快照方案在本地留下过 `plugin.bnu.activity-panel.activity-plan.json` / `plugin.activity-panel.activity-plan.json`，不再被读取（是否删除由用户决定）。
- `session.tool.called.data.input` 是对象；`SessionMessageToolStateStreaming.input` 是**字符串**（半截 JSON），恢复时不要当对象解析。
- 侧栏宽度不可知：折叠行用 `height=1` + `overflow="hidden"` 裁剪成一行；展开靠 `wrapMode="word"` 自动换行。
- 面板渲染不能抛异常：事件回调整体 try/catch，避免拖垮宿主。
- `@opencode/plugin` 锁到与本机 CLI 同版本（2.0.11），升级 CLI 后同步升级。
