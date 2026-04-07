# ModelingProject CLI 的 File-Based YAML 架构实现方案

<aside>
🗂️

这份设计假设 **完全不依赖数据库**。ModelingProject 的唯一持久化介质是一组可版本管理的 YAML 文件。目标不是做一个“把 YAML 读进内存再随便改”的小工具，而是做一个可审查、可编译、可持续演化的工程级 CLI。

</aside>

## 一、先说结论

如果这个 CLI 要完全 file-based，我会把它实现成一个 **compiler-oriented local workspace system**，而不是一个“操作 YAML 文件的命令集合”。

核心原则只有四条：

1. **YAML 是 source of truth**
2. **CLI 不直接依赖数据库，但要维护稳定的 in-memory graph model**
3. **所有命令都先读文件系统 -> 归一化 -> 建图 -> 校验 -> 执行 -> 写回文件**
4. **revision / draft / diff / review 都通过文件快照与变更日志实现**

也就是说，这个 CLI 的本体不是“文件编辑器”，而是：

**File Loader + Graph Builder + Rule Engine + Proposal Engine + Artifact Compiler + Workspace Writer**

## 二、为什么 file-based 是成立的

对这类 ModelingProject 来说，file-based 其实有很强的优点：

- 天然可用 git 做版本管理
- 可离线工作
- 易于 code review
- 易于 branch / merge / PR 工作流
- 易于让人类与 LLM 共同读写
- 易于在 CI 中执行 lint / validate / compile

它的真正挑战不是性能，而是：

- 如何组织文件边界
- 如何保证 identity 稳定
- 如何保证跨文件引用安全
- 如何保证 rewrite 不把 repo 搞乱

所以设计关键不是“用 YAML 存什么”，而是“如何把 YAML repo 设计成一门可维护的系统语言”。

## 三、我会怎样设计目录结构

我建议一份 ModelingProject repo 长这样：

```
modeling-project/
├── mp.yaml
├── revisions/
│   ├── head.yaml
│   └── history/
├── drafts/
│   ├── draft-20260402-add-refund-status/
│   │   ├── draft.yaml
│   │   ├── ops.yaml
│   │   └── proposals/
│   └── ...
├── stories/
│   ├── epics/
│   ├── stories/
│   └── scenarios/
├── roles/
├── ui/
│   ├── app/
│   ├── area/
│   ├── screen/
│   ├── section/
│   └── component/
├── commands/
├── events/
├── command-schemas/
├── event-schemas/
├── view-models/
├── view-model-schemas/
├── processors/
├── triggers/
├── edges/
│   ├── graph/
│   ├── tree/
│   └── traceability/
├── generated/
│   ├── ir/
│   ├── manifests/
│   └── diagnostics/
├── dist/
│   ├── frontend/
│   ├── backend/
│   └── tests/
└── .mp-cache/
```

### 3.1 顶层 `mp.yaml`

这是项目清单文件，类似 repo manifest：

- project id
- name
- version
- current head revision
- file layout version
- lint / validation policy
- compile targets
- default command namespaces
- default story reachability policy

它是 CLI 进入 workspace 的第一入口。

### 3.2 每类 node 独立目录

例如：

- `commands/hotel.booking.cmd.create-booking.yaml`
- `events/hotel.booking.evt.booking.created.yaml`
- `command-schemas/hotel.booking.cmd.create-booking.schema.yaml`
- `event-schemas/hotel.booking.evt.booking.created.schema.yaml`
- `view-models/hotel.booking.view.booking.detail.yaml`
- `view-model-schemas/hotel.booking.view.booking.detail.schema.yaml`
- `processors/hotel.payment.proc.payment.reconcile.yaml`

这样做的原因：

- 每个语义对象有稳定文件边界
- 易于 diff
- 易于被 LLM 单文件读取
- 易于局部加载

### 3.3 Edges 单独存放

不要把所有关系都嵌回 node 文件里。否则跨文件更新会很脆。

我会单独建：

- `edges/graph/*.yaml`：业务关系边
- `edges/tree/*.yaml`：story tree / UI tree
- `edges/traceability/*.yaml`：storyOwnsCommand 等

原因是 graph 的核心问题不是节点本身，而是**连线的一致性与可遍历性**。

## 四、每类 YAML 文件应该长什么样

### 4.1 Node 文件

每个 node 一个文件，示意：

```yaml
kind: cmd
canonicalId: hotel.booking.cmd.create-booking
displayName: Create Booking
description: Create a booking after room selection
version: 1
domains:
  - hotel.booking
tags:
  - checkout
owner: booking-team
spec:
  schemaRef: command-schemas/hotel.booking.cmd.create-booking.schema.yaml
```

对应的 command schema 文件：

```yaml
commandNodeId: hotel.booking.cmd.create-booking
version: 1
input:
  fields:
    - fieldId: f.booking-id
      name: bookingId
      type: scalar.id
      required: true
```

### 4.2 Edge 文件

```yaml
type: commandCausesEvent
from: hotel.booking.cmd.create-booking
to: hotel.booking.evt.booking.created
meta: {}
```

### 4.3 ViewModel 文件

```yaml
kind: viewModel
canonicalId: hotel.booking.view.booking.detail
displayName: Booking Detail
spec:
  fields:
    - fieldId: f.booking-id
      name: bookingId
      type: string
      nullable: false
      source:
        eventNodeId: hotel.booking.evt.booking.created
        eventFieldPath: payload.booking.id
    - fieldId: f.status
      name: status
      type: string
      nullable: false
      source:
        eventNodeId: hotel.booking.evt.booking.confirmed
        eventFieldPath: payload.booking.status
```

对应的 viewModel schema 文件建议单独存放到 `view-model-schemas/`，避免 node identity 与 schema 演化混在一起。

### 4.4 Story 文件

```yaml
kind: story.story
canonicalId: story.hotel.booking.create-booking
displayName: Create booking
role: role.customer
spec:
  summary: Customer creates a hotel booking
  desiredOutcome: Customer sees pending or confirmed booking state
```

注意：

- story 文件不直接手写完整成员列表
- 真正的 subgraph 是编译器 resolve 出来的

## 五、CLI 的核心运行流程

我会把 CLI 实现成 6 个内部阶段。

### Stage 1. Workspace discovery

命令启动后先：

- 找 `mp.yaml`
- 确定 project root
- 读取 layout version
- 读取当前 head / active draft

### Stage 2. File loading

根据命令只加载必要文件：

- `em show cmd.xxx` 只需加载该 node 及附近 edge 文件
- `em validate` 才需全量加载
- `em neighbors` / `em walk` 只需局部索引 + 局部文件读取

这一步很关键。大图下不能每个命令都全量 parse 整个 repo。

### Stage 3. Normalization

把 YAML 读成统一 AST / domain objects：

- parse YAML
- schema validate
- normalize enums
- canonicalId check
- build object maps

### Stage 4. Graph build

建立内存图结构：

- node map by canonicalId
- adjacency list by edge type
- reverse adjacency list
- tree indexes
- viewModel field provenance indexes
- story root indexes

### Stage 5. Command execution

再执行具体命令：

- query
- traversal
- suggest
- revise
- validate
- compile

### Stage 6. Write-back

如果命令会修改内容：

- 先生成变更计划
- 按稳定顺序重写受影响 YAML
- 更新 draft / proposal / revision 文件
- 保持格式稳定，减少 diff noise

## 六、为了支撑这个 CLI，我会做哪些内部模块

如果用 TypeScript 实现，我会把代码组织成下面这样：

```
src/
├── cli/
│   ├── index.ts
│   ├── command-router.ts
│   └── commands/
├── workspace/
│   ├── locate-project.ts
│   ├── load-manifest.ts
│   ├── load-head.ts
│   └── load-draft.ts
├── fs-model/
│   ├── readers/
│   ├── writers/
│   ├── yaml-parser.ts
│   ├── yaml-stringifier.ts
│   └── path-conventions.ts
├── domain/
│   ├── node-types.ts
│   ├── edge-types.ts
│   ├── view-model.ts
│   └── story.ts
├── graph/
│   ├── graph-builder.ts
│   ├── adjacency-index.ts
│   ├── reachability.ts
│   ├── traversal.ts
│   └── story-resolution.ts
├── validation/
│   ├── lint/
│   ├── semantic/
│   └── diagnostics/
├── proposals/
│   ├── suggest-bind.ts
│   ├── revise-bind.ts
│   ├── confirm-bind.ts
│   └── override-metadata.ts
├── drafts/
│   ├── ops-log.ts
│   ├── diff.ts
│   └── submit.ts
├── compiler/
│   ├── story-ir.ts
│   ├── command-ir.ts
│   ├── event-ir.ts
│   ├── ui-ir.ts
│   ├── projection-ir.ts
│   └── compile-all.ts
├── generators/
│   ├── frontend/
│   ├── backend/
│   ├── tests/
│   └── manifests/
└── utils/
```

### 6.1 `workspace/`

负责发现 project root、head revision、draft 上下文。

### 6.2 `fs-model/`

负责把文件系统当成“存储层”来处理：

- 读 YAML
- 写 YAML
- 稳定排序
- 原子写入
- 路径约定

### 6.3 `graph/`

真正核心：

- 建图
- neighbors / walk / trace
- story reachability
- boundary diagnostics

### 6.4 `proposals/`

负责 suggest/revise/confirm 这套非直接写库的 workflow。

### 6.5 `compiler/`

负责从 graph 产出 IR。

### 6.6 `generators/`

负责把 IR 变成代码、配置、manifest、测试。

## 七、draft / revision 如果没有数据库，怎么实现（假设有 Git）

如果可以直接假设有 Git，那么这里就不应该再自造一套“数据库式版本系统”。

更合理的做法是：

- **revision 以 Git commit 为主事实**
- **draft 以 Git branch + working tree 为主事实**
- Event Modeling CLI 只补 Git 没有的那层：语义 diff、语义校验、proposal workflow、codegen orchestration

换句话说：

- Git 管 **file history**
- Event Modeling CLI 管 **semantic history**

### 7.1 Revision = Git-backed semantic checkpoint

这里的 revision 不应优先理解成 CLI 自己保存的一份完整快照，而应理解成：

- 一个可定位的 Git commit
- 或一个带语义标签的提交点

因此 `revision` 需要的不是完整文件副本，而是一份轻量 metadata：

- revision id（可直接用 commit SHA 或其稳定短码）
- message
- createdAt
- author
- validation status
- codegen status
- optional semantic summary

真正的文件内容由 Git 保存；CLI 只维护“这个 commit 在建模语义上代表什么”。

### 7.2 Draft = branch-backed working context

`draft` 也不应该再是一条数据库记录，而应理解成：

- 一个当前工作 branch
- 一份尚未提交的 working tree 变更
- 外加一个可选的 draft metadata 文件

例如：

```
drafts/
└── add-refund-status.draft.yaml
```

这个文件只需要记录：

- draft id
- branch name
- base revision / base commit
- status
- short intent message
- optional active proposal refs

也就是说：

- Git 负责真正的文件差异
- CLI 负责把这组差异命名成一个明确的 modeling draft

### 7.3 `em draft start`

在 Git-native 设计下，`em draft start` 的职责应该改成：

1. 读取当前 Git HEAD
2. 创建或切换到一个语义 branch
3. 写入一个最小 `draft.yaml`
4. 设置当前 workspace 的 active draft context

所以它的本质不是“创建数据库里的 draft record”，而是：

**Git branch orchestration + modeling metadata init**

### 7.4 `em draft diff`

`draft diff` 应该明确输出两层 diff：

#### file diff

直接来自 Git：

- 哪些 YAML 文件变了
- 哪些 schema 文件变了
- 哪些文件新增 / 删除 / 重命名了

#### semantic diff

由 CLI 在 graph / schema 层重新计算：

- 新增了哪些 command / event / viewModel
- 哪些 edge 改了
- 哪些 schema fields 改了
- 哪些 story boundary 改了
- 哪些 validation diagnostics 新增或消失了

因此：

- Git diff 回答“文件改了什么”
- EM diff 回答“语义改了什么”

### 7.5 `em submit`

`submit` 也不应再被设计成“生成一份 revision 快照并存盘”。

在 Git-native 模式下，它应该做的是：

1. 跑 `em validate`
2. 可选跑 codegen
3. 生成 semantic review summary
4. `git add`
5. `git commit`
6. 可选补 tag / release marker / merge policy

所以 `em submit` 的本质是：

**semantic commit command**

### 7.6 哪些东西仍然应该保留在 CLI 里

即使有 Git，下面这些仍然不该交给 Git：

- `story suggest-bind`
- `story revise-bind`
- `story confirm-bind`
- graph-aware validation
- schema-aware diff
- impact review
- codegen diagnostics

原因是这些都不是版本存储问题，而是建模语义问题。

### 7.7 一个更合理的责任边界

如果直接假设有 Git，那么整个系统的责任边界应当写死成：

#### Git 负责

- commit history
- branch / merge
- file diff
- rollback

#### Event Modeling CLI 负责

- graph mutation
- schema mutation
- proposal workflow
- validation
- semantic diff
- codegen orchestration

#### 本地 metadata 只保留

- `mp.yaml`
- `drafts/*.yaml`
- optional semantic revision index
- proposal snapshots

这会比“自己在文件系统里再模拟一套 revision store”干净得多。

## 八、如果完全 file-based，suggest / revise / confirm 要怎么落地

### 8.1 suggest-bind

运行时做：

- 从当前 draft 或 head 构建 graph
- resolve story roots
- 运行 reachability rules
- 生成一个 proposal snapshot YAML

例如：

```
drafts/draft-xxx/proposals/proposal-001.yaml
```

### 8.2 revise-bind

这一步不改 graph，不改真正 node / edge 文件，只改 proposal 文件：

- add-root
- remove-root
- set-mode
- include-boundary
- exclude-boundary
- include-path
- exclude-path

所以 revise 是 **proposal rewrite**。

### 8.3 confirm-bind

confirm 时才真正写入：

- 新增 `storyOwnsCommand` edge 文件
- 或更新 traceability 边文件

这很适合 file-based，因为它天然区分：

- graph truth
- proposal hypothesis

## 九、要怎样保证性能，不然 YAML 一多就爆炸

这是 file-based 方案最大疑问之一，但其实可控。

### 9.1 局部索引缓存

在 `.mp-cache/` 下维护：

- canonicalId -> file path
- reverse reference index
- edge adjacency index
- story root index
- UI consumer index

这不是数据库，只是可重建 cache。

### 9.2 增量加载

- `show/neighbors/walk/trace` 只加载必要节点和边
- `validate/compile` 才全量加载

### 9.3 内容哈希

每个 YAML 文件可带或缓存 hash。

没变化就不重 parse。

### 9.4 稳定序列化

写回必须稳定：

- key 顺序固定
- list 排序策略固定
- 空字段策略固定

这样 Git diff 才干净。

## 十、这个 CLI 的关键工程约束

### 10.1 canonicalId 不可漂

文件名、引用、graph identity 都依赖 canonicalId。

我建议：

- canonicalId 一旦进入 revision，就视为 immutable
- rename 用 migration command，而不是手改字符串

### 10.2 edge 文件不要隐式生成太多

边应该显式存在，除非是编译期派生结果。

否则 repo 会变成一堆难以预测的自动连线。

### 10.3 generated/ 与 source/ 严格分离

绝不能让生成物和源文件混在一起。

否则用户和 LLM 很容易误改 generated assets。

### 10.4 proposal 与 draft 也要分离

proposal 是“建议的故事边界”；

draft 是“准备提交的真实模型变更”。

两者语义不同。

## 十一、如果是我来定义第一版文件布局，我会这样收敛

### MVP 只做四类 source 文件

1. nodes
2. edges
3. manifest
4. drafts/proposals

先不要一开始就把一切拆太细。

### MVP 的核心命令优先级

先实现：

- `project open / ctx`
- `show`
- `neighbors`
- `walk`
- `cmd schema init / cmd field add / cmd schema show`
- `evt schema init / evt field add / evt schema show`
- `story suggest-bind`
- `story revise-bind`
- `story confirm-bind`
- `validate`
- `draft diff`
- `submit`

这些命令打通后，已经足够支撑“持续建模 + review + 演化”。

### 第一版先不要做的事

- 不要先做复杂 GUI builder
- 不要先做多用户并发编辑
- 不要先做 cloud-hosted model store
- 不要先做 overly smart auto-merge

file-based 方案第一优先级是：

**让 repo 成为稳定、可编译、可审查的系统语义资产。**

## 十二、如果问我“完整地实现这个 CLI”的关键步骤

我会按下面顺序落地：

### Step 1. 定 file schema

- 每类 YAML 的 schema
- 文件路径规范
- canonicalId 规则

### Step 2. 实现 loader + graph builder

- 从文件恢复完整图
- 建立局部索引

### Step 3. 实现 lint + validate

- 先保证 repo 不会烂

### Step 4. 实现 local exploration

- `show / neighbors / walk / trace`

### Step 5. 实现 proposal workflow

- `suggest-bind / revise-bind / confirm-bind`

### Step 6. 实现 draft / revision

- `draft start / diff / submit / versions`

### Step 7. 实现 compiler IR

- `story.ir / command.ir / event.ir / ui.ir / projection.ir`

### Step 8. 实现 generators

- 先产 types、contracts、manifests、skeletons，不要急着全自动生成整套业务代码

### Step 9. 接 runtime fabric

- command runtime
- projection runtime
- trigger runtime
- processor runtime

## 十三、我的最终判断

如果完全 file-based，我认为这件事不但可行，而且很可能比“先上数据库”更适合早期阶段。

原因是你现在最重要的资产不是在线查询性能，而是：

- 模型语言是否稳定
- diff 是否清晰
- 编译链是否成立
- 人类与 LLM 是否能协作
- 系统语义是否可持续演化

所以我会把第一版定义为：

**A git-native, YAML-backed, compiler-oriented ModelingProject CLI**

一句话概括：

**不是用 YAML 模拟数据库，而是把 YAML repo 直接当成系统语义源码，再围绕它构建图引擎、规则引擎、提案工作流和编译器。**

## 十四、如果要继续往下走，我建议你下一步补这三份 spec

1. **YAML file schemas**
    - 每类文件的严格 schema
2. **Path conventions**
    - canonicalId 如何映射到文件路径
3. **Compile pipeline contracts**
    - loader 输出什么、graph builder 输出什么、IR 长什么样

这三份一旦定下来，就可以正式开始实现 CLI 了.