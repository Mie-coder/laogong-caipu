# 老公菜谱 V2 UI 实施进度

> 本文件是任务进度的唯一可信入口。每次运行先按 `AGENTS.md` 核对 Git 状态，再从“下一步”继续。

## 最新任务快照

- 更新时间：2026-07-07（已补强 1:1 复刻交接规范）
- 分支：`master`
- Task 5 代码 HEAD：`73aa869 docs: record task 5 completion`
- 当前阶段：当前任务为“复刻1:1设计稿”；首页已复刻，正在继续复刻菜谱页并等待用户视觉验收
- 实施计划：`docs/superpowers/plans/2026-07-02-v2-ui-redesign.md`
- 设计基准：`.agents/rules/style.md`、`.agents/rules/global-style.md`、`.agents/rules/复刻1:1设计规范.md`、`docs/ui-concepts/01-home.png` 至 `08-cook-review.png`

## Task 状态

| Task | 状态 | Commit / 验收 |
| --- | --- | --- |
| 1. 全局视觉原语与应用壳 | 已完成 | `5cb277b..e6a5548`；22/22 tests + build 通过 |
| 2. 首页与导入状态流 | 已完成 | `e6a5548..6b1190e`；review 和 controller verification 通过 |
| 3. 编辑式菜谱列表 | 已完成 | `6b1190e..74b4244`；review 和 controller verification 通过 |
| 4. 菜谱详情与做菜复盘 | 已完成 | `8cc64f1..af2e025`；review、18/18 定向测试、66/66 完整测试和 build 通过 |
| 5. Playwright 三尺寸浏览器验收与截图 | 已完成 | `e86f6dd..73aa869`；主控独立完成 68/68 单测、build、12/12 E2E 与 24 张截图验收；`73aa869` 记录完成文档 |

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

## 下一步

1. 用户直接在浏览器验收 `/recipes` 菜谱页 1:1 复刻效果。
2. 后续复刻规格从 `.agents/rules/style.md`、`.agents/rules/global-style.md`、`.agents/rules/复刻1:1设计规范.md` 读取；若 agent 不能读取 `docs/ui-concepts/*.png`，先补量化页面复刻包。
3. 用户指出视觉差异后，继续按“单点反馈 → 定向测试 → CSS/结构修正 → 浏览器验收”的方式调整。
4. 菜谱页视觉验收通过后，停止 dev server、清理 `.next`，补跑完整 `npm run test` 和 `npm run build`，再更新完成记录。

## 当前工作区（2026-07-07）

- 已跟踪改动：首页和菜谱页 1:1 复刻相关代码、测试和 `progress.md` 记录，尚未提交。
- 未跟踪受保护设计产物：`.agents/`（AI 生成 Markdown 分类归档，含 `design/`、`rules/`、`progress/`）、`docs/ui-concepts/`。
- 未跟踪新增素材：`public/ui-concepts/`（含首页和菜谱页裁图素材）。
- 未跟踪验收产物：`output/playwright-v2/`、`output/playwright/home-393.png`、`output/playwright/home-430.png`。
