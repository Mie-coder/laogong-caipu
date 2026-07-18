# 老公菜谱 Stitch V3 重构设计规格

日期：2026-07-18

状态：已批准（用户于 2026-07-18 确认）

项目：老公菜谱 H5

Stitch 项目：`11371438272675460660`

## 1. 目标

在保留现有 Next.js、React、TypeScript、SQLite、导入解析和菜谱数据流的前提下，将当前界面重构为 Stitch 第三版的 10 个业务屏幕，并补齐第三版中出现的真实功能：收藏、做菜计时、步骤进度和语音播报。

本次交付必须同时满足：

- 以 Stitch 第三版为唯一视觉基准，而不是重新解释设计语言。
- 通用交互原语优先使用 shadcn/ui，业务组件通过组合原语实现。
- 动效遵循 Apple Design 的物理性、即时反馈、可中断和降级原则。
- 所有可见控件均可操作，不交付仅用于截图的假按钮或静态状态。
- 每个实现 Task 经过测试、独立审查和主控验收后才能完成。
- 项目最终生成可供 Claude Code 独立复验的完整验收报告。

## 2. 范围

### 2.1 必须交付的屏幕

| 序号 | 屏幕 | Stitch ID | 主要实现范围 |
| --- | --- | --- | --- |
| 1 | 菜谱确认编辑 | `297577d996c34a9db3daf4a3203cf657` | 标题、标签、食材、步骤编辑与保存 |
| 2 | 图片审核 | `91aa035ec66148b5a8e567d9acf3e10a` | 多选、删除、封面选择、无图继续 |
| 3 | 做菜模式 | `b03461c2568c454e998e922c05086fe4` | 计时、步骤进度、语音和食材轨道 |
| 4 | 导入抽屉 | `b5f3e4ac1b9641ba9151215f192e5942` | 输入、粘贴、键盘避让、拖拽关闭 |
| 5 | 解析进度 | `2c90dc8399ec42b99e1e70aa2b567631` | 四阶段进度、取消、错误恢复 |
| 6 | 菜谱详情 | `aa73e93a171e427ca27f6e8bb417354d` | Hero、食材/步骤、收藏和操作区 |
| 7 | 进入做菜指引 | `d4dcc58287ef48bda5951a87dc04d00c` | 备料确认和做菜会话初始化 |
| 8 | 菜谱详情-复盘抽屉交互优化 | `8150ac8a97e343f4af9ef48c2d756aac` | 评分、反馈、改进项和保存 |
| 9 | 菜谱列表 | `7b38e30bda4043e9a3b0ead67d196a19` | 搜索、筛选、分类、收藏和列表状态 |
| 10 | 首页-导航优化 | `c6e8909e2e72419fa7f800e13a2454fa` | 首页内容、导入入口和双栏导航 |

结构化设计系统资产 `assets/8d9091a183ef44c883a2c9ba4d16d85b` 不是独立业务页面，其内容用于主题 token 和组件样式。

### 2.2 不在本轮范围

- 不把项目重写为其他框架或引入新的全局状态库。
- 不重写 DeepSeek、Crawler 或菜谱解析业务。
- 不建立跨项目 npm 组件包、脚手架或自进化系统。
- 不为了清理旧代码而进行与本次功能无关的大规模重构。
- 不使用 Stitch 临时托管 URL 作为生产图片来源。
- 不把 Stitch 导出的静态 HTML 直接嵌入页面。

跨项目沉淀在本项目完成后单独评估。只有经过实际复用和完整验收的组件，才有资格作为未来组件库候选。

## 3. 设计依据与优先级

发生冲突时按以下顺序裁决：

1. 本规格中已经确认的业务和交互要求。
2. `.stitch/designs/` 中对应屏幕的 HTML 与截图。
3. `.stitch/design-system.json` 与 `resources/style-guide.json`。
4. `.agents/rules/stitch-v3-implementation-constraints.md`。
5. 现有产品数据流和自动化测试所表达的有效业务行为。

根目录 `DESIGN.md`、旧版 `docs/ui-concepts/01-12` 和旧版样式规则仅作为历史资料，不得覆盖 Stitch 第三版。菜谱详情导出截图未完整显示双分段控件属于已知导出缺陷，生产实现必须保留完整的“食材 / 步骤”两个选项。

## 4. 总体架构

### 4.1 分层

```text
Next.js route / server component
        |
        +-- server repository and API routes
        |
        +-- client screen coordinator
                |
                +-- business hooks / reducer
                |
                +-- business composition components
                        |
                        +-- shadcn/ui primitives
                        +-- Framer Motion interaction layer
```

- Server 层负责 SQLite、持久化、查询和外部服务密钥。
- API 层负责 Zod 边界校验、统一错误结构和稳定 DTO。
- Screen coordinator 负责编排页面，不直接承载全部状态细节。
- 复杂状态进入 reducer 或独立 hook，避免多个互相矛盾的布尔值。
- `src/components/ui/` 只放 shadcn/ui 原语及主题变体。
- `src/components/` 放业务组合组件，不复制原语内部实现。

### 4.2 客户端边界

默认保留 Server Component，只有以下场景进入客户端组件：

- 需要手势、抽屉、即时编辑或浏览器状态的界面。
- 需要 Web Speech API、计时、页面可见性或 sessionStorage 的做菜会话。
- 需要乐观更新、交互筛选或本地草稿的列表和导入流程。

数据库、DeepSeek Key 和服务器环境变量不得进入客户端 bundle。

## 5. UI 基础设施

### 5.1 最小 shadcn/ui 基础

基础 Task 统一完成 shadcn/ui 初始化、依赖安装和主题接入。预计使用：

- `Button`
- `Input`
- `Textarea`
- `Label`
- `Checkbox`
- `Tabs`
- `Drawer`
- `Dialog`
- `AlertDialog`
- `DropdownMenu`
- `Skeleton`
- `Sonner`

后续 Task 不得自行更换组件基础、重复安装库或手写相同原语。图标按钮同样必须基于 `Button` 的 variant，而不是散落原生 `<button>`。

### 5.2 业务组件边界

允许自定义以下产品组合：

- `RecipeListRow`
- `RecipeHero`
- `ImageReviewGallery`
- `IngredientRail`
- `RecipeStepTimeline`
- `CookingTimer`
- `CookingProgress`
- `SpeechNarrationControl`
- `BottomNavigation`
- `ImportFlowCoordinator`

这些组件必须有显式 Props 类型、单一职责和定向测试。业务逻辑应放在 reducer、hook 或 service 中，使组件可以独立渲染和测试。

### 5.3 图标和图片

- 常规图标使用 `lucide-react`。
- 禁止 emoji、Material Symbols 字体、混用其他图标库和随手手绘 SVG。
- 产品独有且 Lucide 不具备的图形才允许生成切图。
- 从 `.stitch/assets/manifest.json` 选择实际使用的资源并迁入 `public/` 下稳定目录。
- 首屏 Hero 具有明确尺寸和优先级；非首屏图片延迟加载。
- 所有图片保留稳定长宽比，避免加载时布局跳动。

## 6. 视觉 token 与响应式

`resources/style-guide.json` 映射为全局 CSS variables 和 Tailwind 语义 token。业务组件只引用语义名，不新增任意十六进制颜色。

核心 token 包括：

- 画布 `#FAF9F6`
- 表面 `#FFFFFF`
- 主文本 `#20201E`
- 辅助文本 `#554338`
- 强调色 `#D97832`
- 错误色 `#B54A43`
- 成功色 `#4D7A5B`
- 默认水平 gutter `20px`
- 最小触控目标 `44px`
- 浮层圆角 `20px`
- 抽屉圆角 `24px`

390px 是 Stitch 对照基准，同时必须通过 375px 和 430px。所有固定栏、抽屉和底部导航处理：

- `safe-area-inset-bottom`
- 软键盘出现和收起
- 长标题与长步骤文本
- 无横向溢出
- 内容不被固定操作区遮挡

## 7. 状态与数据流

### 7.1 导入流程

导入流程使用一个可判定的状态模型，而不是分散布尔值：

```text
idle -> parsing -> imageReview -> recipeConfirm -> saving -> completed
          |             |              |           |
          +---------- error / recoverable ----------+
```

- 原始输入在失败、取消或返回时保留。
- 重新提交时取消旧请求，避免旧响应覆盖新结果。
- 解析进度的四阶段是界面状态，但最终成功以 API 响应为准。
- 图片筛选失败允许保留原图进入人工审核，不丢失解析出的菜谱。
- 保存失败停留在确认页，保留所有编辑结果。

### 7.2 收藏

收藏采用 `recipes.is_favorite INTEGER NOT NULL DEFAULT 0`：

- 使用增量、可重复执行的 schema migration。
- 列表摘要和详情 DTO 同时返回 `isFavorite: boolean`。
- 提供幂等更新接口，不依赖客户端反转服务器状态。
- 详情、列表和做菜模式更新后保持一致。
- 刷新和重新进入页面后状态仍然存在。

个人单用户场景不新增 favorites 关联表；若未来出现多用户，再单独迁移。

### 7.3 做菜会话

做菜会话包含：

- 当前菜谱 ID
- 当前步骤
- 已完成步骤集合
- 计时器配置与状态
- 开始时间、累计暂停时长或绝对结束时间
- 语音设置

会话状态在同一浏览器标签内使用 `sessionStorage` 保存，刷新、锁屏或切后台返回后能够恢复。它不是数据库历史；完成做菜后仍通过现有 cooking log API 写入复盘记录。

### 7.4 计时器

计时器不把“每秒减一的 React state”作为真实时间。真实状态使用绝对时间和累计时间推导：

- 开始时保存时间基准。
- 暂停时保存累计值。
- 恢复时建立新时间基准。
- 页面重新可见时用 `Date.now()` 校准。
- 组件卸载时清理 interval、timeout 和事件监听。

界面支持设置、增加、减少、开始、暂停、继续和结束。测试使用 fake timers，不真实等待。

### 7.5 步骤进度

- 步骤完成和撤销均可用。
- 进度由完成集合推导，不单独维护易失真的计数。
- 当前步骤和完成状态写入做菜会话。
- 自动滚动不抢夺正在进行的用户手势。
- 完成全部步骤后提供进入复盘的明确操作，不自动提交复盘。

### 7.6 语音播报

语音封装为独立的 `useSpeechNarration` 或等价 hook：

- 运行前检测 `window.speechSynthesis` 和 `SpeechSynthesisUtterance`。
- 必须由用户操作触发，不自动播放。
- 切换步骤、重新播放、退出做菜或卸载时取消旧语音。
- 不支持时隐藏或禁用控制，并给出可理解说明。
- 语音失败不阻断步骤进度和计时。
- 播报内容只来自当前菜谱步骤文本。

## 8. API、数据库与类型

### 8.1 类型规则

- 新增代码禁止 `any`。
- 修改到的旧 DTO 和数据映射必须补齐类型，但不要求一次清理全仓库。
- 数据库 row、API DTO、领域模型和客户端展示模型名称应明确区分。
- 组件 Props 不直接接收未经校验的任意 API 对象。

### 8.2 API 边界

- POST、PATCH、DELETE 请求体使用 Zod。
- 搜索、分类和筛选查询参数使用 Zod 或等价显式解析。
- 错误使用一致结构，例如 `{ error: { code, message } }`。
- 客户端错误处理兼容非 JSON 失败响应。
- 可被替换的请求支持 `AbortSignal`。
- 收藏写入使用目标状态，重复提交结果一致。

### 8.3 数据库

- Schema 变更只允许增量迁移，不清空用户数据库。
- 多表写入必须在 transaction 中完成。
- 外键保持启用，删除菜谱继续级联清理图片、食材、步骤、标签和复盘。
- 仓储测试使用独立临时数据库。
- migration 和收藏持久化必须有回归测试。

## 9. Apple Design 动效

### 9.1 原则

- 按压反馈从 pointer-down 开始，通常缩放到 `0.98`。
- 手势与动画从当前呈现值继续，不发生跳变。
- 抽屉可反向拖动，并根据位置和释放速度决定关闭或归位。
- 默认使用接近临界阻尼、无明显过冲的 spring。
- 页面转场表达空间关系，但不阻塞输入。
- 导航选中态使用稳定的共享布局动画。

### 9.2 降级

- `prefers-reduced-motion` 下，大位移和弹簧改为短淡入淡出或静态状态变化。
- 减少透明度或不支持 backdrop filter 时，毛玻璃退化为高不透明度表面。
- 动效不是功能前置条件；动画失败不影响保存、导航和表单操作。

### 9.3 性能

- 高频动画优先只修改 `transform` 和 `opacity`。
- 避免嵌套多层大面积 blur。
- 不在 scroll handler 中反复同步读取和写入布局。
- 不为推测性性能问题堆叠 `memo`、`useMemo` 和 `useCallback`。

## 10. 无障碍与安全

- 触控目标至少 44 x 44px。
- 图标按钮具有可理解的 accessible name。
- 收藏使用 `aria-pressed`，选择状态使用适当语义。
- 抽屉和 Dialog 支持键盘关闭、焦点陷阱和关闭后的焦点恢复。
- 解析进度、计时结束和保存结果使用适度的 live region。
- 键盘用户可以完成导入、编辑、做菜和复盘主流程。
- 文本与背景满足可读对比度，焦点样式不能被移除。
- 禁止 `dangerouslySetInnerHTML`。
- 导入 URL 和图片 URL 只接受允许的协议。
- 用户输入失败后保留，不在错误日志中输出密钥或完整敏感响应。

## 11. 错误处理

每个异步界面必须具有 loading、empty、error、disabled 和 retry 行为：

- 页面初次加载失败时显示可重试错误，不伪装为空列表。
- 提交期间防止重复写入，但保留取消或返回路径。
- 收藏乐观更新失败时回滚并提示。
- 语音不可用时降级，不弹出阻断式错误。
- sessionStorage 不可用或内容损坏时安全回到新会话。
- 图片加载失败显示稳定回退画面，不改变主要布局。
- 未知错误转为用户可理解提示，并保留开发侧可诊断信息。

## 12. 实施任务边界

实现分为五个连续 Task：

1. 设计 token、最小 shadcn/ui 基础和应用壳。
2. 首页、菜谱列表和底部导航。
3. 导入抽屉、解析进度、图片审核和菜谱确认。
4. 菜谱详情、收藏持久化和复盘抽屉。
5. 进入做菜指引、做菜会话、计时、步骤进度和语音播报。

任务按依赖顺序实现。默认只有一个实现 agent 写代码；只读规格审查、质量审查或失败分析可以并行。运行环境最多为主控加三个子 agent，不超过用户要求的五个 agent。

每个 Task 的完成门槛：

1. 先得到失败测试或明确的旧版差异证据。
2. 完成范围内实现。
3. 定向测试通过。
4. 独立规格审查通过。
5. 独立代码质量审查通过。
6. 完整单测和生产构建通过。
7. 主控进行相关尺寸的浏览器与视觉验收。
8. 更新 `progress.md` 和最终验收报告中的任务记录。

任何 Critical 或 Important 问题都退回原实现 agent 修正。连续两轮修正仍不通过时，由主控接管或重新拆分任务。

## 13. 测试与最终验收

### 13.1 单元和集成测试

- shadcn 主题变体和关键业务组合。
- 导入 reducer 的合法转移、错误恢复和输入保留。
- 收藏 migration、repository、API 和客户端回滚。
- 计时器的开始、暂停、恢复、后台校准和清理。
- 语音能力检测、播放、取消和降级。
- 步骤完成集合、撤销和 sessionStorage 恢复。
- 抽屉、Dialog、键盘和焦点恢复。

测试优先使用 role、label 和用户行为查询。只有没有稳定语义入口的视觉定位才使用 `data-testid`。不以大面积 snapshot 代替行为断言。

### 13.2 E2E

Playwright 覆盖：

- 首页打开导入抽屉。
- 导入、解析、图片审核、确认编辑和保存。
- 列表搜索、筛选、详情往返和状态恢复。
- 收藏刷新后仍存在。
- 进入做菜、计时、步骤完成和复盘。
- 删除确认和级联结果。
- 请求失败时输入保留和可重试。
- reduced motion 下主流程仍可完成。

### 13.3 视觉验收

10 个屏幕分别在 375、390、430 三个宽度截图，共 30 张必备截图，保存到 `output/playwright-stitch-v3/`。

- 390px 对照 Stitch 截图检查版式、图片裁切、字体层级、间距、圆角和固定区。
- 375px 与 430px 检查响应式、长文本、安全区和无横向溢出。
- 不把 Stitch 自身明显导出缺陷复制到生产实现。

### 13.4 最终门槛

以下全部通过才能将项目结论改为“通过”：

- 每个 Task 的规格与质量审查。
- 全部定向测试。
- 完整 `npm run test`。
- `npm run build`。
- 三尺寸 Playwright E2E。
- 30 张视觉截图人工对照。
- Apple 动效和 reduced-motion 检查。
- 无障碍、安全区和键盘检查。
- shadcn/ui 使用审计。
- `docs/qa/最终验收报告.md` 填写完整。

最终报告必须记录实际命令、结果摘要、commit 范围、失败退回、已知差异和截图索引，供 Claude Code 在相同代码快照上独立复验。没有证据的项目不得预填“通过”。

## 14. 已确认决策

- Stitch 第三版是唯一视觉基准。
- shadcn/ui 是通用组件基础。
- Framer Motion 按 Apple Design 原则实现动效。
- 收藏、计时、步骤进度和语音播报是真实功能。
- 收藏使用 recipes 表布尔字段。
- 做菜会话在当前标签使用 sessionStorage 恢复。
- 语音由用户触发，不支持时降级。
- 子 agent 默认串行实现，主控负责最终验收。
- 未通过的 Task 必须退回修正。
- 最终交付完整验收报告，供 Claude Code 二次验收。
- 跨项目组件库和自进化机制推迟到本项目完成后评估。
