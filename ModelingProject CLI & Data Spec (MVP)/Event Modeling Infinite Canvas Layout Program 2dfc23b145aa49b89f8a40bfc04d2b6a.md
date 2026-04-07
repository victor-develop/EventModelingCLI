# Event Modeling Infinite Canvas Layout Program

<aside>
🧩

**目标**：设计一个独立的 layout program。它不负责事件建模语义本身，只负责把 Event Modeling CLI 输出的 **subgraph** 映射成 web-based infinite canvas 上的稳定布局。

核心要求：

- 只有三条可视泳道：**shared lane(ui / trigger / processor)**、**command / viewModel lane**、**event lane**
- 所有可视箭头都必须 **严格从左往右**
- 支持 **left explore / right explore** 增量扩展
- explore 默认是 **append / prepend**，而不是每次 full relayout
- 在增量探索时尽量 **不打乱已稳定的布局**
</aside>

## 1. 为什么要做成独立 layout program

这个程序应该和 CLI 解耦。

CLI 的职责是返回 **建模语义**：节点、边、路径、frontier、cursor、过滤条件、局部子图。

layout program 的职责是把这些语义对象转成：

- render instances
- x / y 坐标
- edge routing
- merge / duplicate 策略
- incremental explore 后的局部重排

这样做的好处：

- CLI 可以持续演进，但布局器只依赖稳定的中间语义层
- 同一个 subgraph 可以被不同前端复用
- infinite canvas、mini map、静态导出都能复用同一套 layout output
- 可以把 **语义探索** 和 **布局稳定性** 分离开来

## 2. 应该基于哪些 CLI 输出

**主输入不应该是 `em graph --format mermaid`。**

Mermaid 适合文档展示，但不适合作为布局真源，因为它丢失了很多布局器真正需要的结构信息，例如：

- traversal direction
- frontier / cursor
- branch identity
- node occurrence context
- typed edge semantics

更适合做布局输入的是以下命令的结果：

- `em walk`
- `em neighbors`
- `em trace`

其中 `em walk` 最重要，因为它已经是 **path-oriented local subgraph**，而且天然适合增量探索。[[1]](CLI%20Command%20Reference/em%20walk%20f9d22d6f435d4c9293c2725830bd311a.md)

## 3. 布局器的输入层：先做 normalized path envelope

布局器不要直接以「全局 canonical graph」为第一输入，而是先接收一个 **normalized path envelope**。

建议统一成下面的数据结构：

```json
{
  "anchor": {
    "nodeId": "order.refund.cmd.create-refund",
    "occurrenceId": "occ_anchor"
  },
  "branches": [
    {
      "branchId": "b1",
      "direction": "backward",
      "path": [
        { "type": "node", "nodeId": "ui.screen.refund.detail", "nodeKind": "ui.screen" },
        { "type": "edge", "edgeId": "e1", "edgeType": "roleUsesUIToIssueCommand", "displayDirection": "forward" },
        { "type": "node", "nodeId": "order.refund.cmd.create-refund", "nodeKind": "cmd" }
      ]
    },
    {
      "branchId": "b2",
      "direction": "forward",
      "path": [
        { "type": "node", "nodeId": "order.refund.cmd.create-refund", "nodeKind": "cmd" },
        { "type": "edge", "edgeId": "e2", "edgeType": "commandCausesEvent", "displayDirection": "forward" },
        { "type": "node", "nodeId": "order.refund.evt.refund.created", "nodeKind": "evt" },
        { "type": "edge", "edgeId": "e3", "edgeType": "eventRefreshesViewModel", "displayDirection": "forward" },
        { "type": "node", "nodeId": "order.refund.view.refund.detail", "nodeKind": "viewModel" }
      ]
    }
  ],
  "frontier": {
    "left": { "hasMore": true, "cursor": "left_cur_1" },
    "right": { "hasMore": true, "cursor": "right_cur_1" }
  }
}
```

### 3.1 为什么一定要有 occurrence

**关键设计：canonical node 和 render occurrence 必须分离。**

因为同一个节点在 event-flow 里可能在不同 branch / stage / role 上承担不同展示职责。

所以布局器必须允许：

- 一个 canonical node
- 在不同 branch / stage / role 上
- 产生多个 render occurrence

这不是 bug，而是这个布局模型的核心能力。

## 4. 三条泳道的正式定义

### 4.1 可视泳道

1. **shared lane**
    - `ui.*`
    - `trigger`
    - `proc`
2. **command / viewModel lane**
    - `cmd`
    - `viewModel`
3. **event lane**
    - `evt`

### 4.2 ViewModel 的定位

ViewModel **不单独占一条泳道**。

原因：你当前想要的是一个偏 **event-flow / interaction-flow** 的画布，而不是把所有 schema 层节点都拉平成主时间轴。

但它也**不应该被折叠成纯 edge metadata**。

更合适的做法是：

- ViewModel 作为 **显式节点** 参与布局
- 但和 `command` 共用同一条泳道
- 这样画布仍然保持 3 条泳道，而时间阶段仍然完整表达：
    - 发起 / 消费
    - command
    - event
    - viewModel

### 4.3 Story / parentOf

不进入主布局算法。

它们只作为：

- filter 约束
- grouping 信息
- selection 上下文

而不是主画布上的时间推进节点。

## 5. 先把 canonical edges 变成 display edges

在布局前，先做一层 **semantic lifting**。

### 5.1 原始边到显示边的映射

- `roleUsesUIToIssueCommand`
    - display: `shared -> cmd`
- `processorOrTriggerIssuesCommand`
    - display: `shared -> cmd`
- `commandCausesEvent`
    - display: `cmd -> evt`
- `eventRefreshesViewModel`
    - display: `evt -> viewModel`
- `uiOrProcessorConsumesViewModel`
    - display: `viewModel -> shared`
- `eventUpdatesProcessor`
    - display: `evt -> shared`

### 5.2 结果

经过 lifting 之后，布局器处理的是：

- 3 条可视泳道
- 4 类时间阶段节点：`shared` / `cmd` / `evt` / `viewModel`
- 4 种统一的 display step：
    - `shared -> cmd`
    - `cmd -> evt`
    - `evt -> viewModel`
    - `viewModel -> shared`

这会把布局问题简化成一个 **严格单向的 stage layout**。[[2]](../ModelingProject%20CLI%20&%20Data%20Spec%20(MVP)%20823d540bf0eb4a159f5f3cc2ff5690fa.md)

## 6. 核心：4-phase stage-based x 轴模型

### 6.1 定义 stage index

不要直接给节点算 x，而是先给 occurrence 算一个 **stageIndex**。

定义如下：

- `shared` occurrence 放在 `4k`
- `cmd` occurrence 放在 `4k + 1`
- `evt` occurrence 放在 `4k + 2`
- `viewModel` occurrence 放在 `4k + 3`

于是沿着 x 轴形成无限重复模式：

- `... shared(-1) -> cmd(-1) -> evt(-1) -> viewModel(-1) -> shared(0) -> cmd(0) -> evt(0) -> viewModel(0) -> shared(1) ...`

### 6.2 这个模型的最大价值

这样定义以后，每一条主 display edge 都只会让 stage **+1**：

- `shared -> cmd` : `+1`
- `cmd -> evt` : `+1`
- `evt -> viewModel` : `+1`
- `viewModel -> shared` : `+1`

因此：

- 所有箭头天然从左往右
- left explore 只会扩展到更小的 stageIndex
- right explore 只会扩展到更大的 stageIndex
- 已放好的节点不需要整体回流式重算

### 6.3 从 anchor 开始赋值

选定当前 focus occurrence 作为 anchor。

然后给它一个绝对 stage：

- 如果 anchor 是 `shared`，可设为 `0`
- 如果 anchor 是 `cmd`，可设为 `1`
- 如果 anchor 是 `evt`，可设为 `2`
- 如果 anchor 是 `viewModel`，可设为 `3`

接着沿 branch 传播 stage：

- 向右走一个 display edge：`+1`
- 向左走一个 display edge：`-1`

因为输入是 path-oriented envelope，所以这一步不需要先解决全图复杂环问题；它只需要对当前可见 subgraph 的 occurrence graph 做一致赋值。[[1]](CLI%20Command%20Reference/em%20walk%20f9d22d6f435d4c9293c2725830bd311a.md)

## 7. occurrence duplication policy

### 7.1 总原则

**所有 canonical node 都允许拥有多个 render occurrence。**

不要把“唯一渲染”写死成硬规则。

### 7.2 默认策略

但不同类型的节点，重复出现的倾向不同：

- `ui / trigger / proc`：最容易需要多 occurrence
- `viewModel`：也比较容易因为不同 branch / projection context 产生多 occurrence
- `cmd`：默认优先合并
- `evt`：默认优先合并

### 7.3 为什么 shared lane 更容易重复

因为 shared lane 上的对象经常在不同位置扮演不同角色：

- 左边作为 command 发起入口
- 右边作为 viewModel 的消费方 / processor 的被更新方

如果强行只画一次，就很容易破坏“所有箭头都从左往右”的约束。[[3]](Event%20Modeling%20Infinite%20Canvas%20Layout%20Program%202dfc23b145aa49b89f8a40bfc04d2b6a.md)

### 7.4 merge key 建议

建议 occurrence merge key 至少包含：

- canonicalNodeId
- stageIndex
- displayRole
- branchClusterId
- viewModelSignature（仅适用于 viewModel / consumer 相关节点）

只有这些条件兼容时，才允许多个 branch occurrence 合并成同一个 rendered item。

## 8. y 轴算法：lane 内局部排序，而不是全局自由布局

### 8.1 基本坐标

```
x = stageIndex * stageGap
y = laneBaseY(lane) + rowIndex * rowGap
```

其中：

- `laneBaseY(shared)`
- `laneBaseY(commandViewModel)`
- `laneBaseY(event)`

是固定泳道起点。

### 8.2 纵向目标

y 轴要做的不是“漂亮随机排版”，而是满足三个目标：

1. 尽量减少 crossing
2. 保持 branch 局部连续
3. 增量 explore 时尽量稳定，不要大范围跳动

### 8.3 初始顺序

先根据 branch 建一个初始 row order：

- 以 anchor branch group 为中心
- 同一 branch 中相邻 occurrence 尽量映射到相近 row
- backward branches 和 forward branches 可以分别编号后再拼接

一个简单可行的初始策略：

- root branch = 0
- 其他 branch 按首次分叉点 + branchId 排序
- 同 stage、同 lane 的 occurrence 先按 branch order 排

### 8.4 crossing minimization

在初始顺序之上，做 **barycenter / median sweep**：

- 从左到右 sweep 一轮：按前驱的 barycenter 调整 row
- 从右到左 sweep 一轮：按后继的 barycenter 调整 row
- 只在同一 `stage + lane` bucket 内重排

这样能显著减少交叉，同时不会破坏整体阶段结构。

### 8.5 稳定性规则

为了支持 infinite canvas 的增量探索，row 排序必须是 **stable sort with tie-breakers**。

建议 tie-break 顺序：

1. locked row（已有布局锁定）
2. barycenter
3. anchor distance
4. branch priority
5. canonicalNodeId
6. occurrenceId

也就是说：

- 老节点优先保持原位
- 新节点只在必要时插入空位
- 尽量局部重排，不做全局洗牌

## 9. edge routing：正交折线 + stage-aware ports

因为所有主 display edge 都只跨 `+1 stage`，所以 edge routing 可以非常规整。

而且这些 edge **就是画布上的主视觉对象**，不是隐藏的辅助线。

布局器必须明确支持 **箭头跨越 swimlane 分隔，把不同泳道上的 element 直接连起来**。

也就是说，用户应该直接看到：

- `shared -> cmd`
- `cmd -> evt`
- `evt -> viewModel`
- `viewModel -> shared`

这些跨泳道连接，而不是只看到节点相邻却没有明确的跨 lane 连线。

建议：

- source 从 node 的右侧 port 出
- target 从 node 的左侧 port 入
- 默认走 orthogonal polyline
- 先水平出一小段，再垂直对齐，再水平进入目标

### 9.1 bundle 策略

如果一个 event 或 viewModel 扇出到多个目标：

- 可先出一个短 trunk
- 再在 stage gap 中分叉

这样在 fan-out 很大时，可显著降低视觉噪音。

### 9.2 ViewModel 信息怎么显示

因为 ViewModel 现在是显式节点，所以边上只需要显示轻量辅助信息：

- consumed fields count
- warning badge（例如 fieldRefs 缺失）
- projection kind

但这些都不应该影响主 layout 结果。

## 10. explore 的执行模型：append / prepend，不是 full relayout

### 10.1 基本原则

left / right explore **不应该每次都回到 CLI 再把整张图 full relayout**。

更好的方式是：

- 保持当前 visible subgraph
- 对某个 selected occurrence 发起局部 explore
- 只把新返回的 branches append 到 layout state
- 只在受影响的 stage band 内做局部布局

### 10.2 为什么不能默认整图重排

问题不只是 CPU，而是整体交互稳定性：

- visible graph 越大，layout 计算成本越高
- 用户的 mental map 会被打乱
- 节点每次 explore 都漂移，画布难以阅读
- renderer diff 量变大，动画与交互状态更难保持

### 10.3 只有这些情况才允许 full relayout

- lane policy 改变
- occurrence merge policy 改变
- focus mode / anchor model 改变
- 后台做一次低频 rebalance / repack

普通 explore 不应该触发 full relayout。[[3]](Event%20Modeling%20Infinite%20Canvas%20Layout%20Program%202dfc23b145aa49b89f8a40bfc04d2b6a.md)

## 11. LayoutState：前端 / worker 需要长期保存的布局状态

```json
{
  "canonicalNodes": {},
  "canonicalEdges": {},
  "occurrences": {},
  "displayEdges": {},
  "stageBuckets": {},
  "laneRows": {},
  "locks": {},
  "frontierHandles": {},
  "viewport": {
    "minStage": -8,
    "maxStage": 12,
    "zoom": 0.9,
    "centerX": 1280,
    "centerY": 640
  }
}
```

### 11.1 occurrence 最少需要存什么

```json
{
  "occurrenceId": "occ_vm_1",
  "canonicalNodeId": "order.refund.view.refund.detail",
  "nodeKind": "viewModel",
  "lane": "commandViewModel",
  "stageIndex": 7,
  "rowIndex": 3,
  "displayRole": "projection",
  "branchClusterId": "bc_12",
  "lockLevel": "soft"
}
```

### 11.2 lock level 建议

- `hard`
    - 绝对不动
    - 适用于用户手动拖动过的位置
- `soft`
    - 尽量不动，必要时允许微调
    - 适用于已有稳定布局节点
- `free`
    - 新插入节点
    - 可自由求解位置

## 12. 增量 API 设计

### 12.1 `appendExploreResult()`

用于 right explore。

```tsx
appendExploreResult(args: {
  state: LayoutState
  sourceOccurrenceId: string
  envelope: NormalizedPathEnvelope
}): LayoutPatch
```

执行步骤：

1. normalize 新返回的 branches
2. semantic lift
3. 生成新 occurrences / displayEdges
4. 从 source occurrence 向右传播 stage
5. 只对新增 stage 和相邻少量旧 stage 求 row
6. 输出 patch，而不是整个图

### 12.2 `prependExploreResult()`

用于 left explore。

```tsx
prependExploreResult(args: {
  state: LayoutState
  sourceOccurrenceId: string
  envelope: NormalizedPathEnvelope
}): LayoutPatch
```

执行步骤与 append 对称，只是 stageIndex 向更小值扩展。

### 12.3 `LayoutPatch`

```json
{
  "addedOccurrences": [],
  "updatedOccurrences": [],
  "addedEdges": [],
  "updatedEdges": [],
  "updatedStageRange": {
    "min": 6,
    "max": 10
  },
  "viewportHint": {
    "revealDirection": "right"
  }
}
```

关键点：**布局器输出 patch，renderer 应用 patch。**

## 13. 局部 relayout 的影响范围规则

### 13.1 推荐规则

如果新增内容落在：

- `stage = 9, 10, 11`

则默认只允许重算：

- `8 ~ 12`

或者最多：

- `7 ~ 13`

### 13.2 band 级别求解

局部重排时：

- 远离新增区域的旧 stage 不动
- 只在受影响 band 内做 barycenter sweep
- soft lock 节点允许微调
- hard lock 节点不可被移动

### 13.3 viewport 行为

- right explore：优先 reveal 右侧新增区域
- left explore：优先 reveal 左侧新增区域
- 不要因为新增内容自动把旧中心点完全打散

## 14. 推荐输出 contract

布局器最终不应该只输出坐标，而应该输出一个可直接给 canvas renderer 使用的结构：

```json
{
  "nodes": [
    {
      "occurrenceId": "occ_cmd_1",
      "canonicalNodeId": "order.refund.cmd.create-refund",
      "nodeKind": "cmd",
      "lane": "commandViewModel",
      "stageIndex": 5,
      "rowIndex": 2,
      "x": 1200,
      "y": 240,
      "displayRole": "command",
      "width": 220,
      "height": 56
    },
    {
      "occurrenceId": "occ_vm_1",
      "canonicalNodeId": "order.refund.view.refund.detail",
      "nodeKind": "viewModel",
      "lane": "commandViewModel",
      "stageIndex": 7,
      "rowIndex": 2,
      "x": 1680,
      "y": 240,
      "displayRole": "projection",
      "width": 220,
      "height": 56
    }
  ],
  "edges": [
    {
      "displayEdgeId": "de_1",
      "fromOccurrenceId": "occ_cmd_1",
      "toOccurrenceId": "occ_evt_1",
      "kind": "cmd-to-evt",
      "points": [[1420,268],[1480,268],[1480,360],[1540,360]],
      "meta": {}
    },
    {
      "displayEdgeId": "de_2",
      "fromOccurrenceId": "occ_evt_1",
      "toOccurrenceId": "occ_vm_1",
      "kind": "evt-to-viewModel",
      "points": [[1660,360],[1720,360],[1720,268],[1780,268]],
      "meta": {}
    }
  ],
  "frontiers": [
    {
      "occurrenceId": "occ_vm_1",
      "direction": "right",
      "cursor": "walkcur_001"
    }
  ]
}
```

## 15. 关键算法伪代码

```tsx
function appendExploreResult(args: {
  state: LayoutState
  sourceOccurrenceId: string
  envelope: NormalizedPathEnvelope
}): LayoutPatch {
  const lifted = semanticLift(args.envelope)
  const occs = buildOccurrences(lifted)
  const staged = assignStagesFromSource(occs, args.sourceOccurrenceId, args.state, "right")
  const merged = mergeOccurrences(staged, args.state)
  const affectedBand = computeAffectedBand(merged, args.state)
  const rows = solveLaneRowsInBand(merged, args.state, affectedBand)
  const edges = routeEdgesInBand(merged, rows, affectedBand)
  return buildPatch(merged, rows, edges, affectedBand)
}
```

```tsx
function prependExploreResult(args: {
  state: LayoutState
  sourceOccurrenceId: string
  envelope: NormalizedPathEnvelope
}): LayoutPatch {
  // same as append, but stages extend toward smaller indices
}
```

```tsx
function solveLaneRowsInBand(
  graph: RenderGraph,
  prev: LayoutState,
  band: { minStage: number; maxStage: number }
) {
  // 1. seed order by branch
  // 2. keep hard-lock nodes fixed
  // 3. keep soft-lock nodes as stable as possible
  // 4. left-to-right barycenter sweep inside band
  // 5. right-to-left barycenter sweep inside band
  // 6. assign row slots with minimal displacement
}
```

## 16. 最终结论

如果目标是：

- 只有 3 条可视泳道
- ViewModel 和 command 共用泳道，但仍是显式节点
- 箭头永远从左往右
- 支持 infinite canvas
- 支持 left explore / right explore
- 普通 explore 不触发 full relayout
- 对 Event Modeling CLI 的 path-oriented 输出天然兼容

那么最合适的方案是：

1. 先把 CLI 输出归一化为 **path envelope**
2. 把 canonical node 提升为 **render occurrence model**
3. 把 canonical edge 提升为 **display edge model**
4. 用 **4-phase stage-based x-axis** 保证所有箭头单向前进
5. 用 **lane-local stable row solver** 解决 y 轴和 crossing
6. 用 **append / prepend patch model** 支持左右探索
7. 用 **LayoutState + local band relayout** 保证性能和稳定性

这会让布局器既保持 Event Modeling 语义正确，又能满足 web infinite canvas 对稳定性和可探索性的要求。