# dsh-mode-picker

新会话开局选模式。开一个新会话时锁定输入框，把部署里的全部 agent 模式 以按钮阵列铺在输入框附近；点一个，按钮收起、输入框解锁，这个空白会话就切到你选的模式。

## 为什么存在

DSH 自带的模式 chip 是个下拉菜单，且只负责「暂存一个选择、等下一个空白会话来认领」。本插件把这件事换成一个显式的开局闸门：不选不发车，选错了还能改。

截至 2026-09 ：GitHub `dsh-plugin` topic 下没有实现该形态的插件。唯一近亲 [dsh-preset-switch](https://github.com/aorucshiea/dsh-preset-switch) 做的是「绕过官方的 blank-session lock、在会话内切 preset」，与本插件的方向相反。

## 用的是官方既有接口

不新造机制，全部走官方：

| 作用 | 接口 | 来源 |
| --- | --- | --- |
| 锁定输入框 | `ctx.conversation.blocks.set(sessionId, { reason })` | `dsh-client-ui-conversation` 的 composer block 注册表；其源码注释原话是「另一个插件停下一个会话输入的唯一方式」 |
| 承载按钮 | 槽位 `conversation.hero.agentPreset` | 新会话页专用的模式座位（single / root） |
| 列出模式 | `ctx.remote.agentPresets.list()` | 官方 Remote API，交付对象与自带的模式 chip 同款 |
| 切换模式 | `ctx.remote.agentPresets.select(sessionId, presetId)` | 同上；宿主只允许**空白**会话重组，发出首轮后会被 `agent-preset/locked` 拒绝 |

读取当前会话沿用官方 chip 的读法：`useSessions` 拿 `state.current`，再从 `state.byId` 取该会话的 `blank` 与 `projectionValues.agentPreset`。这个座位是 root 作用域，**不会**收到 `sessionId` prop，只能这样自己找。

## 行为

- 有空白会话且面板展开 → 输入框被锁，占位提示变成「选择一个模式开始这个会话」，按钮阵列铺开。
- 点某个模式 → 收起成一枚胶囊（`模式 · 当前模式名 · 切换`），输入框解锁。
- 点那枚胶囊 → 随时重新展开改选；展开时标题写明当前模式，并提供「保留当前模式，收起」退出。
- 损坏的 preset 按钮置灰，悬停显示宿主给出的原因。

## 已知取舍

- **位置**：座位在输入框**上方**，不在框内。框内那一层（`conversation.input.overlay`）在还没有会话的新建页上不渲染，且会话快照为空时读它的字段会抛异常——那正是第一版无声失败的原因。
- **接管**：`conversation.hero.agentPreset` 是 single 座位，本插件占位后，官方那枚模式 chip 在新会话页不再渲染（两侧功能重叠，不是故障）。停用本插件即恢复。
- 选择只在客户端内存里记一次；刷新页面后若会话仍为空，面板会再次展开询问（此时仍可改选，不会破坏任何东西）。

## 安装

从 GitHub 装（推荐）：

```
dsh plugin --profile web add github:soddix/dsh-mode-picker
```

从本地目录装（开发时）：

```
dsh plugin --profile web add link:<本目录绝对路径>
```

两种方式都还要把 `dsh-mode-picker` 加进 profile `package.json` 的 `dsh.profile.bundles`——`dependencies` 只把包装上，`bundles` 才决定它进不进组合树。改完刷新页面即可（客户端半边是页面加载时取的静态资源）；宿主半边（`lib/index.js`）的代码改动需要重启 `dsh web`。

> 未发布到 npm，`private: true` 保持不动——它只挡 `npm publish`，不挡上面两种安装方式。

## 开发时的诊断出口

`lib/index.js` 提供了一个只写文件的诊断汇：客户端把观察到的状态 POST 到 `/dsh-mode-picker/diag`，宿主追加到包目录下的 `diag.log`。浏览器侧插件很难看着 console 调，把观察结果落到**本机文件**上能让排查闭环留在本机。`diag.log` 已在 `.gitignore` 里，不会进仓库。
