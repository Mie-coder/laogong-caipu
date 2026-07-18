# 老公菜谱 Stitch V3 实施进度

> 本文件是任务进度的唯一可信入口。每次运行先按 `AGENTS.md` 核对 Git 状态，再从“下一步”继续。

## 最新任务快照

- 更新时间：2026-07-18（Stitch V3 Task 1 已通过三轮独立复审与主控验收，准备开始 Task 2）
- 分支：`master`
- Task 5 代码 HEAD：`73aa869 docs: record task 5 completion`
- 1:1 复刻提交：`7604460 feat: replicate home and recipe list designs`
- 导入/详情/复盘 1:1 复刻提交：`1233318 feat: replicate remaining recipe flows`
- 当前阶段：Stitch V3 Task 1 已完成；shadcn/Radix/Vaul 基础、Stitch token、Apple reduced-motion 和 44px 触控契约已落地，下一步为首页、菜谱列表与导航
- 实施规格：`docs/superpowers/specs/2026-07-18-stitch-v3-redesign-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-18-stitch-v3-redesign.md`
- 旧版复刻基准：`.agents/rules/style.md`、`.agents/rules/global-style.md`、`.agents/rules/复刻1:1设计规范.md`、`docs/ui-concepts/01-home.png` 至 `08-cook-review.png`
- 新版 Stitch 设计基准：`.stitch/designs/`、`.stitch/design-system.json`、`resources/style-guide.json`

## 旧版 Task 状态

| Task | 状态 | Commit / 验收 |
| --- | --- | --- |
| 1. 全局视觉原语与应用壳 | 已完成 | `5cb277b..e6a5548`；22/22 tests + build 通过 |
| 2. 首页与导入状态流 | 已完成 | `e6a5548..6b1190e`；review 和 controller verification 通过 |
| 3. 编辑式菜谱列表 | 已完成 | `6b1190e..74b4244`；review 和 controller verification 通过 |
| 4. 菜谱详情与做菜复盘 | 已完成 | `8cc64f1..af2e025`；review、18/18 定向测试、66/66 完整测试和 build 通过 |
| 5. Playwright 三尺寸浏览器验收与截图 | 已完成 | `e86f6dd..73aa869`；主控独立完成 68/68 单测、build、12/12 E2E 与 24 张截图验收；`73aa869` 记录完成文档 |

## Stitch V3 Task 状态

| Task | 状态 | Commit / 验收 |
| --- | --- | --- |
| 1. Stitch token、shadcn/ui 与应用壳 | 已完成 | `d882719`、`416c46b`、`d86c574`；三轮独立复审最终 Spec PASS / Quality APPROVED；主控 85/85 tests、build 与范围审计通过 |
| 2. 首页、菜谱列表与导航 | 待开始 | 依赖 Task 1 |
| 3. 导入抽屉、解析、图片审核与确认编辑 | 待开始 | 依赖 Task 1-2 |
| 4. 菜谱详情、收藏持久化与复盘抽屉 | 待开始 | 依赖 Task 1-3 |
| 5. 做菜指引、会话、计时、步骤进度与语音 | 待开始 | 依赖 Task 1-4 |
| 6. 完整 E2E、三尺寸视觉验收和 Claude Code 交接 | 待开始 | 依赖全部实现 Task |

## Task 1 当前记录（2026-07-18）

- 基线检查在依赖变更前完成：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test` 失败，`sh: vitest: command not found`；`PATH=/Users/mie/.hermes/node/bin:$PATH npm run build` 失败，`sh: next: command not found`。
- 原因：当前 linked worktree 未安装 `node_modules`；尚未修改业务代码或依赖清单。

### Task 1 实现与验证记录（2026-07-18）

- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/stitch-v3-foundation.test.tsx` 因缺少 `@/components/ui/button` 失败；随后使用精确兼容版本 `shadcn@2.1.8` 初始化并添加 Button、Input、Textarea、Label、Checkbox、Tabs、Drawer、Dialog、AlertDialog、DropdownMenu、Skeleton 和 Sonner。
- 兼容性决议：保留 Next.js 14 + Tailwind CSS 3；最初 `shadcn@latest` 的 Base UI/Tailwind 4 未提交产物已移除；`shadcn@2.10.0` 因 `Validation failed: tailwind: Required` 被放弃。
- TDD GREEN：新增的 foundation test 2/2 通过；完整回归 `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test` 为 15 files / 79 tests 通过。
- 生产验证：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run build` 成功，Next.js 14.2.35 完成类型检查、9/9 静态页面生成和优化。
- 原语审计：`bottom-sheet.tsx` 与 `skeleton-card.tsx` 没有手写按钮、输入、文本域或 dialog；仅 shadcn 的 Input / Textarea 原语保留对应原生标签。`git diff --check` 通过。
- 为适配 Vaul 的模态抽屉和 Sonner 全局提示，最小更新既有 `v2-shell`、菜谱列表和详情测试：抽屉交互先关闭再访问背景内容，Toast 断言改为 Sonner 调用；业务实现范围未扩大。
- 实现已提交，等待主控按实施约束完成独立规格与质量复审后再将 Task 标为完成。

### Task 1 最终验收记录（2026-07-18）

- 实现提交：`d882719 feat: establish Stitch V3 UI foundation`。
- 第一轮修正：`416c46b fix: address Stitch V3 foundation review`，关闭 reduced-motion、44px 触控目标、destructive foreground 和测试完整性问题。
- 第二轮修正：`d86c574 fix: preserve checkbox checked styling`，修复 Tailwind 3 Checkbox 父状态选择器并补实 Drawer CSS 契约。
- 独立 reviewer 第三轮结论：`Spec Compliance: PASS`、`Task Quality: APPROVED`，Critical / Important / Minor 均为 None。
- 主控独立验收：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test` 为 15 files / 85 tests 通过；`npm run build` 成功并生成 9/9 静态页面；`git diff --check 0ec856b..d86c574` 通过。
- 受保护的 `DESIGN.md`、`docs/ui-concepts/09-12` 和 `output/playwright*` 未进入提交。

### Task 1 复审修正记录（2026-07-18）

- 修复 commit：`fix: address Stitch V3 foundation review`（基线 Task 1：`d882719`）。
- 独立复审指出 reduced-motion 的 `null` 安全态、Vaul 自动动画、触控命中盒和 destructive foreground token 四项 Important；已按最小范围修正。
- 新增 RED 证明：基础/壳层定向契约在旧实现下 4 项失败；实现后 `tests/unit/stitch-v3-foundation.test.tsx tests/unit/v2-shell.test.tsx` 为 2 files / 15 tests 通过。
- PageTransition 仅在 `useReducedMotion() === false` 时保留空间位移；Drawer 的 `data-reduced-motion` 只缩短自动动画/过渡，不覆盖 Vaul 拖拽 transform，modal、portal、焦点和 Escape 关闭保持可用。
- 44px 命中盒覆盖 Input、Checkbox、Tabs、Dialog close、Dropdown 和 AlertDialog 操作；Checkbox 视觉框保持 16px，Textarea 保持 60px。
- 最终验收：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test` 为 15 files / 84 tests 通过；`PATH=/Users/mie/.hermes/node/bin:$PATH npm run build` 成功（9/9 静态页）；`git diff --check` 通过。

### Task 1 Checkbox 复审修正（2026-07-18）

- 新增 RED 行为契约确认：Checkbox Root 点击后虽进入 `data-state="checked"`，但旧 Tailwind 3 arbitrary selector 无法让其 16px 视觉 span 获得选中颜色。
- 修正为 Root `group` 与视觉 span `group-data-[state=checked]` 变体；生产 CSS 审计确认生成 `.group[data-state=checked] .group-data-[state=checked]...` 的正确父子选择器方向。
- 同时完成 reduced-motion CSS 契约：true/null 包含 0.01ms Drawer/overlay 自动动画规则且不覆盖 transform，explicit false 不带 reduced-motion 属性。
- 验收：定向 2 files / 16 tests、完整 15 files / 85 tests、生产 build（9/9 静态页）和 `git diff --check` 均通过。

## Task 4 完成记录

完成内容：

- 图片优先的详情页、备料勾选、步骤编号和固定操作栏。
- 五星评分、老婆评价、改进标签/文字、提交与错误保留。
- 删除菜谱的更多菜单、返回菜谱列表和复盘成功后重新加载。
- 无图时顶部操作保持深色可见；最新复盘展示 `notes`；复盘表单不再伪造固定“今天 19:30”。
- 实施与修正 commit 范围：`8cc64f1..af2e025`。

验收（2026-07-02，Hermes Node）：

- 代码审查：Task 4 最终 4 文件相对 `0b3707a` 的 diff 已逐项审查，无越界问题。
- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-detail-v2.test.tsx tests/unit/cooking-log-sheet.test.tsx`：2 files / 18 tests 通过。
- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test`：14 files / 66 tests 通过。
- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run build`：Next.js 生产构建成功。
- `rg -n "canvas-confetti|confetti\\(|glass-card|rounded-pill|👨‍🍳|📝|😔|😐|🙂|😋|😍|⭐" src/components/recipe-detail.tsx src/components/cooking-log-sheet.tsx`：无匹配（退出码 1，符合预期）。
- `git diff --check`：通过。
- 工作区：Task 4 代码已提交；仅保留受保护的未跟踪设计产物。

## 工作区保护

以下文件/目录是用户或设计产物，不得回滚或清理：

- `.agents/rules/style.md`
- `.agents/rules/global-style.md`
- `docs/ui-concepts/`
- `.agents/design/Figma高保真原型生成提示词.md`

## Task 5 当前记录

已提交内容：

- 三个 Chromium 项目：`mobile-375`、`mobile-390`、`mobile-430`，单 worker、独立临时 SQLite、每次启动自动清库。
- 主流程：首页、导入抽屉、解析、图片审核、菜谱确认、详情、做菜复盘。
- 次流程：筛选、管理、真实删除、详情往返和列表滚动位置恢复。
- 错误与边界：解析失败保留输入、图片筛选降级、返回不重复解析、长文本换行、无横向溢出、固定栏不遮挡、reduced motion。
- 三个宽度各 8 张截图，共 24 张，保存于 `output/playwright-v2/`，不提交到 Git。

实现与审查状态：

- Task 5 commit：`b2d84ac test: verify v2 mobile flows and screenshots`；完成记录 commit：`73aa869 docs: record task 5 completion`。
- 配套生产修正：`e86f6dd`、`3786f6f`、`aa3af5d`、`8660bbc`。
- 实现子 agent：连续两次直接运行 `npm run test:e2e` 均为 12/12；完整单测 14 files / 68 tests；build 通过；截图精确 24 张。
- 规格复审：通过。
- 质量复审：无 Critical / Important；仅保留两个非阻断 Minor：滚动恢复可增加上界断言、Unsplash stub 可提升到全局 `beforeEach`。
- 主控独立最终验收（2026-07-03）：
  - `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test`：14 files / 68 tests 通过。
  - `PATH=/Users/mie/.hermes/node/bin:$PATH npm run build`：Next.js 生产构建成功，9/9 静态页面生成。
  - `PATH=/Users/mie/.hermes/node/bin:$PATH AI_PROVIDER=mock DATABASE_PATH=/tmp/laogong-caipu-v2-e2e.sqlite npm run test:e2e`：三个项目共 12/12 通过，用时 2.2 分钟。
  - 截图计数：`output/playwright-v2/` 共 24 张，375 / 390 / 430 各 8 张且文件名完整。
  - `git diff --check`：通过。

协作约束：

- 最终验收由主控执行；子 agent 负责实现或独立审查，不能代替主控验收。
- 同时活跃的子 agent 不得超过 5 个；当前运行环境最多 4 个并发槽位（包含主控），天然不会超过此上限。

## 本次文档补充（2026-07-07）

完成内容：

- 依据 `docs/ui-concepts/01-home.png` 扩写 `.agents/rules/style.md` 的“首页”章节。
- 新增 430px 基准画布、纵向坐标、字体、图片、导入行、最近做过、底部导航、响应式约束和验收要点。
- 目标是让后续实现 agent 可直接按 `.agents/rules/style.md` 复刻首页视觉。

验收：

- `rg -n "TBD|TODO|待定|占位|\\?\\?" .agents/rules/style.md`：无匹配（退出码 1，符合预期）。
- `git diff --check`：通过。
- 仅文档变更，未运行单元测试、E2E 或构建。

## 当前任务：复刻1:1设计稿（2026-07-07）

完成内容：

- 根据 `.agents/rules/style.md` 首页章节复刻首页：标题区、全宽主图、主标语、导入操作行、最近做过列表和底部导航。
- 新增本地静态视觉素材：`public/ui-concepts/home-hero.png`、`home-recent-beef.png`、`home-recent-wings.png`。
- 修复用户浏览器标注问题：导入行占满横向内容宽度，箭头右对齐。
- 新增 `.agents/rules/复刻1:1设计规范.md`，记录本次 1:1 复刻方法、CSS 策略、素材裁剪、测试和浏览器验收方式。

验收：

- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/v2-shell.test.tsx`：8/8 通过，覆盖导入行满宽和箭头右对齐。
- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test`：14 files / 70 tests 通过。
- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run build`：Next.js 生产构建成功，9/9 静态页面生成。
- Playwright 393px 视口量取 `.home-import-row`：`{"x":22.78125,"y":503.0625,"width":347.421875,"height":73}`。
- 当前本地服务：`http://127.0.0.1:3000`，使用临时预览库 `/tmp/laogong-home-preview.sqlite`。

### 菜谱页继续复刻（2026-07-07）

完成内容：

- 根据 `docs/ui-concepts/06-recipe-list.png` 继续复刻 `/recipes` 菜谱页：标题区、搜索底线、文字筛选、重点首条、缩略图列表行和底部导航选中态。
- `RecipeList` 增加 `recipe-list-*` 专用结构类，保持原搜索、筛选抽屉、管理删除、长按多选和详情跳转数据流不变。
- `RecipeCard` 增加 `variant="list"` 以还原菜谱页缩略图行；默认卡片行为保留。
- 新增本地静态视觉素材：`public/ui-concepts/recipe-list-featured-beef.png`、`recipe-list-wing.png`、`recipe-list-fish.png`、`recipe-list-beans.png`。
- 临时预览库 `/tmp/laogong-home-preview.sqlite` 已补齐截图中的四条菜谱数据，方便直接浏览验收。

验收：

- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-list-v2.test.tsx` 先因缺少 `.recipe-list-page` / `.recipe-list-feature-image` 失败，确认新测试能捕捉旧实现。
- 定向 GREEN：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-list-v2.test.tsx`：14/14 通过。
- 相关回归：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-list-v2.test.tsx tests/unit/recipe-card.test.tsx tests/unit/v2-shell.test.tsx`：3 files / 24 tests 通过。
- `git diff --check`：通过。
- 本地服务检查：`curl http://127.0.0.1:3000/recipes` 返回 200；应用内浏览器 hydrate 后检测到 4 条菜谱、3 条缩略图行和四组截图元数据。
- 本轮未跑完整 `npm run test` 和 `npm run build`；为保持用户当前预览服务不断开，暂不停止 dev server。最终标记完成前需补跑完整测试和构建。

### AI 生成 Markdown 分类归档（2026-07-07）

完成内容：

- 新建 `.agents/` 作为 AI 生成文档归档目录，并按用途拆分：
  - `.agents/design/`：早期设计文档、MVP 文档、Figma 高保真原型提示词。
  - `.agents/rules/`：全局样式、页面规格、1:1 复刻规范。
  - `.agents/progress/`：后续阶段性进度归档；根目录 `progress.md` 仍是唯一可信入口，不能移动。
- 当前分类后的 Markdown：
  - `.agents/design/2026-06-17-laogong-caipu-design.md`
  - `.agents/design/2026-06-17-laogong-caipu-mvp.md`
  - `.agents/design/Figma高保真原型生成提示词.md`
  - `.agents/rules/style.md`
  - `.agents/rules/global-style.md`
  - `.agents/rules/复刻1:1设计规范.md`
  - `.agents/progress/README.md`
- 同步更新 `progress.md` 和 `docs/superpowers/plans/` 中对 `.agents/rules/style.md`、`.agents/rules/global-style.md`、`.agents/rules/复刻1:1设计规范.md`、Figma 提示词文档的引用路径。
- 根目录保留项目入口和运行必需文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`progress.md`。

验收：

- `find .agents -maxdepth 3 -type f -name '*.md' | sort`：AI 生成文档已按 `design/`、`rules/`、`progress/` 分类。
- `find . -maxdepth 2 -type f -name '*.md' | sort`：根目录不再散落 AI 生成 Markdown。
- `rg -n '\\.agents/(style|global-style|复刻1:1设计规范|Figma高保真原型生成提示词)\\.md|global-\\.agents/style\\.md|docs/Figma高保真原型生成提示词\\.md' . --glob '*.md' --glob '!node_modules/**'`：无错误旧路径残留。
- 仅文档移动和引用更新，未运行单元测试、E2E 或构建。

### 1:1 复刻规范补强（2026-07-07）

完成内容：

- 扩写 `.agents/rules/复刻1:1设计规范.md`，从“首页复刻记录”补强为可交接执行规范。
- 新增无聊天截图交接流程：后续 agent 必须自己读取 `docs/ui-concepts/*.png`；如果不能读图，必须先补量化页面复刻包，不能直接声称 1:1。
- 新增页面复刻包字段：画布、路由、class hook、纵向坐标、横向边距、字体、图片、图标、列表/表单、固定区、状态数据、自动化验收和禁止项。
- 新增首页与菜谱页已沉淀 class 锚点、菜谱页裁图命令、元数据格式、DOM 验收信号和 1:1 误差阈值。

验收：

- `rg -n "TBD|TODO|待定|占位|\\?\\?" .agents/rules/复刻1:1设计规范.md`：无匹配（退出码 1，符合预期）。
- `git diff --check`：通过。
- 仅文档变更，未运行单元测试、E2E 或构建。

### 提交记录（2026-07-07）

已提交：

- `7604460 feat: replicate home and recipe list designs`

提交内容：

- 首页和菜谱页 1:1 复刻代码、样式与测试。
- `.agents/` 分类归档后的设计与规则文档。
- `docs/ui-concepts/` 设计稿源文件。
- `public/ui-concepts/` 本地裁图素材。

提交前验收：

- `git diff --check`：通过。
- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx tests/unit/recipe-list-v2.test.tsx tests/unit/recipe-card.test.tsx tests/unit/v2-shell.test.tsx`：4 files / 39 tests 通过。
- 本轮未运行 `npm run build`；为保持用户当前预览服务不断开，未停止 dev server。

## Stitch 设计系统交付（2026-07-17）

完成内容：

- 用户确认以 Apple 的层级与触控原则结合 Cookly 的轻量烹饪风，旧版视觉不再作为新版约束。
- 新增四张新版视觉基准：`09-home-apple-cookly.png`、`10-recipe-detail-apple-cookly.png`、`11-cooking-mode-apple-cookly.png`、`12-recipe-list-apple-cookly.png`。
- 新增根目录 `DESIGN.md`，作为 Stitch 进一步生成屏幕的语义设计系统和唯一规则入口。
- `DESIGN.md` 覆盖视觉气质、精确色值、字体、尺寸、圆角、材质、图像、组件、页面配方、动效、无障碍、Stitch 提示模板、禁止项和验收清单。
- 橙色规则已按用户反馈收敛：普通屏幕约 5%，上限 8%；每屏最多一个实心橙色主操作；首页导入入口和详情页分段控件不得使用大面积橙色填充。
- 做菜模式采用横向滚动备料和纵向连续步骤；菜谱列表采用圆形菜品图、轻分隔线和双栏底部导航。

验收：

- `wc -l DESIGN.md`：520 行。
- `rg -n "TBD|TODO|待定|占位|\\?\\?|—|–|#FF6B6B|Instrument|Fraunces" DESIGN.md`：无匹配。
- `rg -n "Muted Tangerine|orange|橙色|segmented|分段" DESIGN.md`：颜色预算、组件限制和页面级橙色规则均存在。
- `git diff --check`：通过。
- 本轮仅新增设计文档和设计稿，未修改业务代码，因此未运行单元测试、E2E 或构建。
- 当前工作区：`DESIGN.md` 与 `docs/ui-concepts/09-12` 为未跟踪新版设计产物；既有 `output/playwright-v2/`、`output/playwright/home-393.png`、`output/playwright/home-430.png` 保持未跟踪且未清理。

## 下一步

1. 以 Stitch 第三版作为唯一视觉基准；根目录 `DESIGN.md` 和早期概念图仅保留为历史资料，不再约束实施。
2. 用户已确认做菜模式中的收藏持久化、计时、步骤完成进度和语音播报全部纳入真实功能，不允许只做视觉占位。
3. Task 1 已完成实现、测试和构建，主控应完成独立规格与代码质量复审，并在通过后标记完成。
4. 主控复审通过后，按 Task 2 迁移首页、菜谱列表与导航。
5. 跨项目组件库和自进化机制推迟到本项目完成后，根据真实复用和验收证据另行设计。

## Stitch 第三版同步与评估（2026-07-18）

完成内容：

- 从 Stitch 项目 `11371438272675460660` 同步用户指定的 10 个业务屏幕，每屏均保存生成 HTML 与截图到 `.stitch/designs/`。
- 下载 10 份 HTML 内引用的 28 张菜品与食材图片到 `.stitch/assets/`，并生成 `manifest.json` 保存远程 URL 与本地文件映射。
- 逐张视觉审阅菜谱确认、图片审核、做菜模式、导入抽屉、解析进度、菜谱详情、进入做菜指引、复盘抽屉、菜谱列表和首页导航优化。
- 确认 Design System 条目是资产 `assets/8d9091a183ef44c883a2c9ba4d16d85b`，不是普通屏幕；其结构化信息保存为 `.stitch/design-system.json`。
- 新增 `.stitch/metadata.json`，记录同步时间、屏幕 ID、逻辑尺寸、下载尺寸、画布位置和本地文件映射。
- 从 10 份 HTML 的 `<head>` 提取并核对颜色、字体、字号、间距和圆角 token，保存为 `resources/style-guide.json`。
- 本轮只同步和评估设计产物，没有修改业务代码，也没有初始化 shadcn/ui。

发现的关键实现问题：

- 用户已确认以 Stitch 第三版为唯一视觉基准；Stitch HTML 中的 Inter、Noto Serif / 宋体感标题和第三版 token 可直接进入实施，不再受根目录 `DESIGN.md` 的冲突规则约束。
- 菜谱详情分段控件 HTML 同时包含“食材 / 步骤”，但导出截图只清晰显示“步骤”，实现时应修正为完整双分段控件，不能照搬截图缺陷。
- 用户已确认做菜模式新增的计时、步骤进度、语音播报和收藏都必须真实可用；现有代码只有食材勾选与复盘，实施时需要补充前端状态、浏览器语音能力和收藏持久化。
- 当前项目没有 `components.json`、Radix、CVA 或 shadcn/ui 组件，后续需要先建立最小 shadcn 基础再迁移常用控件。
- 通用图标优先使用 Lucide/shadcn 可访问 SVG；只有缺少合适系统图标的独特图形才生成并切出本地资源。
- 新增 `.agents/rules/stitch-v3-implementation-constraints.md` 作为所有实现 agent、修正 agent 和 reviewer 的强制输入，明确 shadcn/ui 优先、禁止重写通用原语、Lucide 图标、Apple 动效、样式 token、TDD、文件范围和退回规则。
- 用户授权复杂任务使用子 agent 开发，由主控负责架构、集成、完整测试、三尺寸视觉验收和最终效果判断；实现任务顺序执行，独立审查和失败排查可并行。
- 用户要求子 agent 并发最多 5 个；当前运行环境只有 4 个并发槽位且包含主控，因此实际硬上限为“主控 + 3 个子 agent”。默认只运行 1 个实现子 agent，只有互不写同一文件的只读审查或失败分析才临时并行。
- 项目完成时必须填写并完成 `docs/qa/最终验收报告.md`，记录 commit 范围、环境、验收命令与原始结果摘要、10 屏三尺寸视觉矩阵、完整交互矩阵、动效与无障碍检查、失败退回记录、已知差异、截图索引和最终结论，供用户使用 Claude Code 再次独立验收。模板初始状态全部为“待执行”，禁止预填通过。

验收：

- `.stitch/designs/`：10 份 HTML + 10 张截图；`.stitch/assets/`：28 张内部图片；全部下载命令退出码 0。
- 10 张截图均通过本地原图查看完成视觉审阅。
- 10 份 HTML 的核心色值和六个间距 token 完全一致。
- 本轮未运行单元测试、E2E 或构建；仅新增设计同步产物与进度记录。

## 导入抽屉 1:1 复刻（2026-07-07）

完成内容：

- `BottomSheet` 精简顶部标题行间距与高度：拖动条、标题 20px/600、说明、120px 初始输入框、18px 粘贴图标、12px/17px 辅助提示、48px 圆角 8px 主按钮。
- 增加 `.bottom-sheet` / `.bottom-sheet-content` / `.import-sheet-lead` / `.import-sheet-textarea` / `.import-sheet-hint` / `.import-sheet-error` / `.import-sheet-submit` 稳定锚点，按 复刻 1:1 规范挂在 class hook 上写尺寸，不再只藏 Tailwind class 串。
- `globals.css` 增加 `@layer components` 下的 `.import-sheet-*` 禁用 `resize`、统一 `letter-spacing: 0`、主按钮 `:active` opacity 0.88。
- `.agents/rules/style.md` 中导入抽屉章节（§2）补充画布、字体、纵向坐标、锚点、规则与验收要点。
- `.agents/rules/复刻1:1设计规范.md` 已沉淀导入页锚点清单。
- 新增测试断言 `.bottom-sheet`、`.import-sheet-textarea`、`.import-sheet-submit` 挂载在预期节点上。

验收：

- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx tests/unit/v2-shell.test.tsx tests/unit/recipe-list-v2.test.tsx tests/unit/recipe-card.test.tsx`：4 files / 39 tests 通过。
- 本轮未跑完整 `npm run test` 和 `npm run build`；为保持用户当前预览服务不断开，暂不停止 dev server。最终标记完成前需补跑完整测试和构建。

## 详情页与复盘抽屉 1:1 复刻（2026-07-08）

完成内容：

- 根据 `docs/ui-concepts/07-recipe-detail.png` 改造详情页：顶部全宽菜品图、返回/编辑/更多浮层、宋体感菜名、文本元信息、备料/步骤标签、食材勾选列表、大号步骤编号和底部“查看复盘 / 标记做过”操作栏。
- `ImageCarousel` 增加 `variant="detailHero"`，详情页使用横向 hero 比例；导入图片审核仍保留原方形轮播。
- 详情页隐藏全局底部导航，避免与固定操作栏叠加；返回、删除、复盘提交、食材勾选本地状态等原业务行为保留。
- 根据 `docs/ui-concepts/08-cook-review.png` 改造复盘抽屉：复盘专用 `BottomSheet` 变体、五星评分、老婆评价、下次改进快捷标签、当前做菜时间展示、深墨色保存按钮和保存后提示。
- 复盘抽屉新增快捷标签 `少盐`、`火小一点`、`时间短一点`、`再辣一点`；提交时与手写改进内容合并到 `husbandImprovementNotes`，做菜时间只展示，不向 payload 注入假的 `cookedAt`。
- `.agents/rules/style.md` 和 `.agents/rules/复刻1:1设计规范.md` 已补充详情页、复盘抽屉 1:1 实施规格与 class 锚点。

验收：

- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-detail-v2.test.tsx` 先因缺少 `.recipe-detail-page` 失败，确认详情页设计契约测试能捕捉旧实现。
- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/cooking-log-sheet.test.tsx` 先因缺少快捷标签、`.cook-review-*` 锚点和 `今天 19:30` 时间行失败，确认复盘抽屉设计契约测试能捕捉旧实现。
- 定向 GREEN：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-detail-v2.test.tsx`：12/12 通过。
- 定向 GREEN：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/cooking-log-sheet.test.tsx`：8/8 通过。
- 相关回归：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-detail-v2.test.tsx tests/unit/cooking-log-sheet.test.tsx tests/unit/v2-shell.test.tsx tests/unit/import-flow-v2.test.tsx`：4 files / 43 tests 通过。
- 本轮暂未跑完整 `npm run test` 和 `npm run build`；为保持用户当前预览服务不断开，暂不停止 dev server。最终标记完成前需补跑完整测试和构建。

## 导入中间流程 1:1 复刻（2026-07-08）

完成内容：

- 根据 `docs/ui-concepts/03-parsing.png` 改造解析中页面：全屏顶部返回/标题、全宽菜品图、来源摘要、四阶段纵向时间线、自动保存/预计时间提示和取消解析按钮。
- 根据 `docs/ui-concepts/04-image-review.png` 改造图片审核页：标题 `选择菜谱图片`、`N / 总数 已选` 计数、全部原图大图预览、横向缩略图、显式封面标记、设为封面/取消选择操作、AI 推荐说明、固定 `确认图片（N）` 和 `无图保存`。
- 根据 `docs/ui-concepts/05-recipe-confirm.png` 改造菜谱确认页：顶部保存草稿、封面缩略图、宋体感可编辑菜名、元信息、概览/食材/步骤标签、标签 chips、食材与调料双列底线编辑、大号步骤序号、固定保存提示和保存按钮。
- `ImageCarousel` 增加 `variant="imageReview"`，图片审核显示全部 `imageUrls`，`filterImages` 结果只决定初始选中和初始封面。
- 新增本地静态视觉素材：`public/ui-concepts/import-parsing-hero.png`。
- `.agents/rules/style.md` 和 `.agents/rules/复刻1:1设计规范.md` 已补充 03/04/05 的 1:1 实施规格与 class 锚点。

验收：

- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx` 先因缺少 `.import-parsing-page`、`.image-review-page`、`.recipe-confirm-page` 等设计锚点失败，确认新契约能捕捉旧实现。
- 定向 GREEN：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx`：18/18 通过。
- 相关回归：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx tests/unit/v2-shell.test.tsx tests/unit/recipe-detail-v2.test.tsx tests/unit/cooking-log-sheet.test.tsx tests/unit/recipe-list-v2.test.tsx tests/unit/recipe-card.test.tsx`：6 files / 62 tests 通过。
- 真实导入流（DeepSeek，2026-07-08）：使用用户给定的菠萝咕噜肉小红书分享文本，在 `AI_PROVIDER=deepseek DATABASE_PATH=/tmp/laogong-home-preview.sqlite` 服务下跑通首页导入抽屉 → 解析中 → 图片审核 → 菜谱确认 → 保存 → 详情页。
  - 解析中：`.import-parsing-page` 显示来源 `来自小红书 · 拒绝不了的酸酸甜甜的菠萝咕噜肉 酸甜开胃超下饭！`。
  - 图片审核：`.image-review-page` 显示 `7 / 27 已选`、27 张缩略图、20 张未选图、按钮 `确认图片（7）`。
  - 菜谱确认：DeepSeek 返回 `菠萝咕噜肉`，元信息 `家常菜 · 中等 · 30 分钟`，标签 `下饭菜 / 炒菜 / 酸甜`，12 项食材/调料，6 个步骤。
  - 保存结果：`POST /api/recipes` 返回 201，跳转 `http://127.0.0.1:3000/recipes/6`，详情页 `.recipe-detail-page` 存在，标题为 `菠萝咕噜肉`。
- 完整单测：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test`：14 files / 76 tests 通过。
- `git diff --check`：通过。
- `rg -n "TBD|TODO|待定|占位|\\?\\?" .agents/rules/style.md .agents/rules/复刻1:1设计规范.md`：无匹配（退出码 1，符合预期）。
- 预览服务：后台 `screen` 会话 `laogong-deepseek-preview` 正在提供 `http://127.0.0.1:3000/recipes/6`，`curl -I` 返回 `HTTP/1.1 200 OK`。
- 本轮暂未跑 `npm run build`；为保持用户当前预览服务不断开，暂不停止 dev server。最终标记完成前需补跑构建。

### 确认菜谱页布局失真修复（2026-07-08）

问题：

- 用户反馈 `05-recipe-confirm.png` 对应的确认菜谱页存在明显布局失真：食材行下方外露上移/下移/删除按钮，步骤行外露删除和 `添加步骤`，导致食材区只露两行、步骤区被切断、底部保存栏过早贴近内容。

根因：

- 复刻时为保留编辑能力，将行级编辑控件直接放入普通布局流；这些控件在设计稿预览态不应外露，占据了额外行高。

修复：

- 新增 `.recipe-confirm-layout-hidden`，让食材/步骤的上移、下移、删除、添加按钮保留可访问和测试能力，但从视觉布局流中移除。
- 步骤行右侧只保留 `.recipe-confirm-step-grip` 拖拽提示符号，匹配设计稿。
- 食材与步骤列表高度恢复为设计稿的底线式预览节奏，不再被行级操作控件撑开。
- `.agents/rules/style.md` 和 `.agents/rules/复刻1:1设计规范.md` 已补充“确认页预览态不得外露行级编辑控件”的规则。

验收：

- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx -t "matches the 1:1 recipe confirmation design contract"` 先因 `.recipe-confirm-ingredient-actions` 缺少 `.recipe-confirm-layout-hidden` 失败。
- 定向 GREEN：同命令通过，1/1 测试通过。
- 相关回归：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx tests/unit/v2-shell.test.tsx`：2 files / 26 tests 通过。
- `git diff --check`：通过。
- `rg -n "TBD|TODO|待定|占位|\\?\\?" .agents/rules/style.md .agents/rules/复刻1:1设计规范.md`：无匹配（退出码 1，符合预期）。

### 确认菜谱页交互回归修复（2026-07-08）

问题：

- 用户继续反馈确认菜谱页多个可见控件“点击没效果”：编辑菜名、概览/食材/步骤 tabs、添加标签、查看全部项；同时食材与用量两列底线存在纵向不齐。

根因：

- 1:1 复刻时将 tabs、加号、编辑图标和查看全部先做成了静态视觉锚点，没有同步恢复交互状态。
- 食材名称使用 input、用量使用 textarea，但二者默认高度不同，导致同一行左右底线不在同一水平线上。

修复：

- `RecipeConfirmForm` 增加确认页局部交互状态：tabs 点击切换 `.is-active` / `aria-selected` 并滚动到对应分区；查看全部项/步可展开并进入 `.is-expanded`；添加标签通过输入反馈追加标签。
- 编辑菜名按钮点击后聚焦并选中菜名；各分区右侧编辑图标改为真实按钮，聚焦对应输入或触发添加标签。
- 食材/调料用量 textarea 改为默认单行，CSS 统一名称与用量输入高度，确保两列底线对齐。
- `.recipe-confirm-layout-hidden` 增加 `pointer-events: none`，避免隐藏行级控件影响真实点击层。
- `.agents/rules/style.md` 和 `.agents/rules/复刻1:1设计规范.md` 已补充“预览态可见控件必须可交互”的确认页规则。

验收：

- TDD RED：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx -t "keeps confirmation preview controls interactive"` 先因点击 `编辑菜名` 后焦点仍在 `body` 失败。
- 定向 GREEN：同命令通过，1/1 测试通过。
- 导入流回归：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx`：1 file / 19 tests 通过。
- 相关回归：`PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v2.test.tsx tests/unit/v2-shell.test.tsx`：2 files / 27 tests 通过。
- `git diff --check`：通过。
- `rg -n "TBD|TODO|待定|占位|\\?\\?" .agents/rules/style.md .agents/rules/复刻1:1设计规范.md`：无匹配（退出码 1，符合预期）。
- 预览服务：后台 `screen` 会话 `laogong-deepseek-preview` 仍在运行，`curl -I http://127.0.0.1:3000/` 返回 `HTTP/1.1 200 OK`。

### 提交记录（2026-07-08）

已提交：

- `1233318 feat: replicate remaining recipe flows`

提交内容：

- 导入抽屉、解析中、图片审核、菜谱确认、详情页、复盘抽屉 1:1 复刻代码与样式。
- 确认菜谱页布局失真和点击无反馈回归修复。
- 03/04/05/07/08 相关单测、规则文档和 `progress.md` 记录。
- 新增解析中页面本地视觉素材 `public/ui-concepts/import-parsing-hero.png`。

提交前验收：

- `PATH=/Users/mie/.hermes/node/bin:$PATH npm run test`：14 files / 77 tests 通过。
- `git diff --check`：通过。
- `rg -n "TBD|TODO|待定|占位|\\?\\?" .agents/rules/style.md .agents/rules/复刻1:1设计规范.md`：无匹配（退出码 1，符合预期）。
- 本轮未运行 `npm run build`；为保持用户当前预览服务不断开，未停止 dev server。

## 当前工作区（2026-07-08）

- 已跟踪改动：无。
- 未提交改动：无。
- 未跟踪验收产物：`output/playwright-v2/`、`output/playwright/home-393.png`、`output/playwright/home-430.png`。
- 真实导入预览服务当前由后台 `screen` 会话 `laogong-deepseek-preview` 提供。
