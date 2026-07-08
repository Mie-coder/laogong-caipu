# 老公菜谱 v2.0 Page Style

本文件规定 8 个页面的结构、视觉和交互。全局令牌与基础组件遵循 `global-style.md`。

## 1. 首页

参考：`docs/ui-concepts/01-home.png`

### 1.1 复刻目标

- 以 430px 宽手机画布为 1:1 基准，截图视觉尺寸约为 `430 × 932`。
- 正式 H5 不手绘系统状态栏图标；若做静态原型，可按截图保留 58px 状态栏。
- 页面气质是“编辑感菜谱杂志 + 轻工具入口”：暖白背景、真实菜品大图、宋体感大标题、发丝线分区。
- 首页首屏不能出现毛玻璃卡片、大输入框、渐变背景、彩色 CTA 面板或营销式 hero 文案。

### 1.2 画布与全局容器

```css
.home-page {
  width: 100%;
  max-width: 430px;
  min-height: 100dvh;
  margin: 0 auto;
  background: #fffaf7;
  color: #24201e;
  overflow-x: hidden;
  padding-bottom: calc(104px + env(safe-area-inset-bottom, 0px));
}
```

- 设计稿左右内容边距：25px；375px 宽时可压到 20px，430px 时必须回到 25px。
- 推荐令牌：`--page-x: clamp(20px, 5.8vw, 25px)`。
- 所有文字 `letter-spacing: 0`，不要用负字距压缩中文。
- 背景为纯暖白 `#fffaf7`，不能叠全局渐变、光斑或纹理。

### 1.3 字体

- 品牌标题和主标语使用宋体/衬线感字体：
  `"Songti SC", "Noto Serif SC", "STSong", "SimSun", serif`。
- 正文、元信息、导航文字使用：
  `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif`。
- 大标题必须是黑色高对比，不加阴影、不加渐变、不描边。

### 1.4 纵向布局坐标（430px 基准）

| 区块 | x | y | w | h | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| 状态栏安全区 | 0 | 0 | 430 | 58 | H5 不绘制图标，只保留顶部节奏 |
| 顶部标题组 | 25 | 65 | 250 | 58 | 标题 + 副标题 |
| 历史按钮 | 361 | 72 | 44 | 44 | 无背景点击区，图标居中 |
| 主图 | 0 | 136 | 430 | 271 | 全宽，圆角 10px |
| 主标语组 | 25 | 438 | 380 | 70 | 大标题 + 说明 |
| 导入入口 | 25 | 527 | 380 | 73 | 上下发丝线，整行可点 |
| 最近做过标题 | 25 | 631 | 380 | 26 | 左标题，右查看全部 |
| 最近做过第 1 行 | 25 | 660 | 380 | 88 | 图、文字、更多按钮 |
| 分隔线 | 25 | 748 | 380 | 1 | 仅列表项之间出现 |
| 最近做过第 2 行 | 25 | 760 | 380 | 88 | 同第 1 行 |
| 底部导航 | 0 | 848 | 430 | 84 | 顶部发丝线 + 安全区 |

实现时允许随真实 viewport 高度纵向自然延展，但 430px 宽截图下这些 y 值误差应控制在 4px 内。

### 1.5 顶部标题区

内容：

- 标题：`老公菜谱`
- 副标题：`今晚做什么`
- 右侧图标：`Clock3` 或 `History`

规格：

- 标题位置：`margin-left: var(--page-x)`，顶部约 65px。
- 标题字号 `34px`，字重 `700`，行高 `1.15`，颜色 `#24201e`。
- 副标题在标题下方 8px，字号 `14px`，行高 `20px`，颜色 `#7a706c`。
- 历史按钮点击热区 `44 × 44px`，右边距 25px，顶部约 72px。
- 历史图标尺寸 `25px`，描边 `2px`，颜色 `#1f1b19`，无圆形底、无阴影。

### 1.6 主图

视觉内容：

- 必须是真实明亮菜品图，主体是一锅家常肉菜/鸡翅，陶瓷砂锅在画面右侧偏中，辅以桌布、香菜或米饭。
- 不使用暗色遮罩，不裁掉主菜，不放文字，不加渐变。

布局：

```css
.home-hero-image {
  width: 100%;
  height: min(271px, 63vw);
  max-height: 271px;
  min-height: 236px;
  object-fit: cover;
  object-position: 58% 50%;
  border-radius: 10px;
  display: block;
}
```

- 430px 基准：顶部 y=136px，高 271px，宽 430px。
- 图片贴满屏幕左右边缘，不受 `--page-x` 约束。
- 圆角约 10px；不要使用 16px 以上大圆角。
- 图片下方到主标语顶部留白约 30px。

### 1.7 主标语

内容：

- 标题：`今晚认真做一道菜`
- 说明：`把收藏整理成真正能照着做的步骤`

规格：

- 容器左右边距 `var(--page-x)`，顶部约 438px。
- 标题字号 `32px`，字重 `700`，行高 `1.2`，字体同品牌标题，颜色 `#24201e`。
- 标题单行显示；375px 下如果溢出，优先降到 `30px`，不要换成两行。
- 说明位于标题下方 12px，字号 `14px`，行高 `22px`，颜色 `#7a706c`。
- 标语区不放在卡片里，不加背景、不加边框。

### 1.8 导入入口行

内容：

- 左侧图标：`Sparkles`
- 标题：`从小红书导入菜谱`
- 副标题：`粘贴分享文字，自动整理食材与步骤`
- 右侧图标：`ArrowRight`

布局：

```css
.home-import-row {
  margin: 31px var(--page-x) 0;
  height: 73px;
  border-top: 1px solid #ded8d3;
  border-bottom: 1px solid #ded8d3;
  display: grid;
  grid-template-columns: 48px 1fr 32px;
  align-items: center;
}
```

- 行高固定 73px，整行可点击。
- 左图标尺寸约 `32px`，颜色 `#ff6b61`，放在 44px 点击区内；不要用 emoji。
- 文本列左起约 x=78px。
- 标题字号 `18px`，字重 `700`，行高 `25px`，颜色 `#24201e`。
- 副标题距离标题 4px，字号 `14px`，行高 `20px`，颜色 `#7a706c`。
- 右箭头尺寸 `28px`，描边 `2px`，颜色 `#1f1b19`，靠右对齐。
- 行背景保持透明，不使用按钮底色、阴影或完整卡片边框。
- 点击后打开导入底部抽屉，关闭后保留首页滚动位置。

### 1.9 最近做过

标题行内容：

- 左侧：`最近做过`
- 右侧：`查看全部` + `ChevronRight`

标题行规格：

- 顶部距离导入行底部约 31px。
- 左标题字号 `18px`，字重 `700`，行高 `26px`，颜色 `#24201e`。
- 右侧文字字号 `14px`，行高 `22px`，颜色 `#7a706c`；chevron 尺寸 `18px`。
- 右侧入口无背景，点击进入菜谱列表。

列表项规格：

```css
.home-recent-item {
  height: 88px;
  display: grid;
  grid-template-columns: 80px 1fr 32px;
  column-gap: 17px;
  align-items: center;
}

.home-recent-thumb {
  width: 80px;
  height: 73px;
  border-radius: 6px;
  object-fit: cover;
}
```

- 第 1 行顶部 y=660px，第 2 行顶部 y=760px。
- 缩略图位置 x=25px，宽 80px，高 73px，圆角 6px。
- 文字列从 x≈122px 开始。
- 菜名字号 `17px`，字重 `700`，行高 `24px`，颜色 `#24201e`。
- 元信息距离菜名 10px，字号 `15px`，行高 `22px`，颜色 `#7a706c`。
- 元信息中的点使用 ` · `，不要用竖线或标签胶囊。
- 更多按钮使用 `Ellipsis`，点击热区 `44 × 44px`，图标尺寸 `24px`，颜色 `#24201e`，无圆形底。
- 列表项之间只有一条 `1px #e6dfdb` 发丝线，左对齐内容边距。
- 最近做过为空时仍保留标题行，下方显示一行安静文案和导入入口，不使用插画或大 emoji。

示例数据必须与截图一致：

1. `番茄炖牛腩` / `45 分钟 · 老婆评分 4.8`
2. `蒜香鸡翅` / `30 分钟 · 做过 3 次`

### 1.10 底部导航

内容：

- 左：`PencilLine` + `导入`
- 右：`BookOpen` + `菜谱`
- 首页当前项为 `导入`。

规格：

```css
.bottom-nav {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  height: calc(84px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid #ded8d3;
}
```

- 430px 基准顶部 y≈848px。
- 不使用毛玻璃模糊、阴影、大圆角或浮动胶囊导航。
- 两个导航项等宽，各占 50%，图标上文字下。
- 图标尺寸 `28px`，文字字号 `13px`，行高 `18px`。
- 当前项颜色 `#ff6b61`；未选中颜色 `#171412`。
- 当前项顶部有短下划线，宽 `46px`，高 `2px`，位于导航顶部边线内侧，居中于当前导航项。
- 首页点击当前“导入”时打开导入抽屉；点击“菜谱”进入 `/recipes`。

### 1.11 响应式约束

- 375px、390px、430px 三个宽度都不得横向滚动。
- 内容边距使用 `clamp(20px, 5.8vw, 25px)`；图片和底部导航保持全宽。
- 主图高度按 `min(271px, 63vw)` 缩放，不能低于 236px。
- 主标语在 375px 下允许字号降到 `30px`；其它标题不随 viewport 宽度连续缩放。
- 最近做过缩略图保持 `80 × 73px`；375px 下文字列可自然收窄，但不能压缩图和更多按钮点击区。
- 页面内容底部必须预留底部导航高度，第二条列表不能被导航遮挡。

### 1.12 验收要点

- 430px 宽截图下：标题、主图、导入行、最近做过和底部导航的纵向位置与参考图误差不超过 4px。
- 页面背景是纯暖白，主图贴边，内容区没有卡片容器。
- 珊瑚色只出现在 Sparkles、当前底部导航和短下划线，占比很小。
- 所有图标为线性图标，除 Sparkles 外不使用填充图标。
- 发丝线只用于导入行上下、列表分隔和底部导航顶部。
- 文案、标点和最近做过示例数据与截图一致。

## 2. 导入抽屉

参考：`docs/ui-concepts/02-import-sheet.png`

### 2.1 结构

1. 背景保留首页并加半透明遮罩。
2. 白色底部抽屉。
3. 顶部拖动条、标题、说明、关闭按钮。
4. 分享文本输入区和粘贴操作。
5. 辅助提示。
6. 固定在抽屉底部安全区上方的深墨色”开始智能解析”按钮。

### 2.2 画布与容器

```css
.bottom-sheet {
  max-height: 78vh;
  padding: 8px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  border-radius: 8px 8px 0 0;
  background: #ffffff;
  box-shadow: 0 -8px 30px rgba(46, 39, 37, 0.10);
}
```

- 白色实体背景，顶部圆角 8px，不使用毛玻璃。
- 顶部拖动条：宽 36px，高 4px，居中，颜色 `#e9e3df`。
- 标题行下边距 20px；内容区可滚动；底部操作区固定。
- 375px–430px 宽度下左右边距 20px。

### 2.3 字体

| 用途 | 字号 | 字重 | 行高 | 颜色 |
| --- | ---: | ---: | ---: | --- |
| 标题 | 20px | 600 | 1.4 | `#2e2725` |
| 说明 | 14px | 400 | 22px | `#6f6865` |
| 字段标签 | 14px | 400 | 20px | `#2e2725` |
| 输入文字 | 16px | 400 | 25px | `#3d3633` |
| 粘贴按钮 | 14px | 600 | 20px | `#2e2725` |
| 辅助提示 | 12px | 400 | 17px | `#9a928e` |
| 主按钮 | 16px | 600 | 1.4 | 白色（底 `#2e2725`） |

### 2.4 纵向坐标（390px 基准）

| 区块 | 间距/位置 | 说明 |
| --- | --- | --- |
| 拖动条 | 顶部 8px | 居中，36×4px |
| 标题行 | 拖动条下方 12px | 高 44px，左边标题，右 44px 关闭 |
| 说明 | 标题行下方 20px | 14px/22px，灰 |
| 字段标签 | 说明下方 12px | mb-8 |
| 输入框 | 标签下方 8px | 初始高度 120px |
| 粘贴按钮 | 输入框下方 12px | 44px 高，图标 18px |
| 辅助提示 | 粘贴按钮下方 12px | 12px/17px |
| 底部分隔线 | 内容区与操作区之间 | `1px solid #e9e3df` |
| 主按钮 | 分隔线顶部下方 16px | 高 48px，圆角 8px |

### 2.5 锚点 class hook

- `.bottom-sheet` — 抽屉容器
- `.bottom-sheet-content` — 滚动内容区
- `.import-sheet-lead` — 说明段落
- `.import-sheet-textarea` — 分享文本输入框
- `.import-sheet-hint` — 辅助提示
- `.import-sheet-error` — 错误提示
- `.import-sheet-submit` — 主按钮

### 2.6 规则

- 抽屉高度约占屏幕 58%–72%。
- 输入框只使用 1px 细边框。
- 输入为空时主按钮禁用。
- 粘贴失败时聚焦输入框。
- 关闭抽屉不得清空已输入内容。
- 主按钮固定在抽屉底部安全区上方。
- 按下主按钮时 opacity 降至 0.88，不缩放。

### 2.7 验收要点

- 背景首页可见但被半透明遮罩覆盖。
- 标题、关闭按钮在同一行两端。
- 输入框使用细边框，无大圆角、无毛玻璃。
- 按钮高度 48px，深墨色底白字，圆角 8px。
- 主按钮禁用时色值跟随 `--color-disabled`。

## 3. 解析进度

参考：`docs/ui-concepts/03-parsing.png`

### 3.1 画布与根节点

- 设计稿原图：853 × 1844；CSS 基准：430 × 930。
- 页面路由：`/` 导入流程内部 `stage === "parsing"`。
- 根节点：`.import-parsing-page`，全屏流程页，出现时隐藏全局 `.bottom-nav`，`main` 不保留 AppShell gutter。
- 背景：`#fffaf7`，不用毛玻璃卡片和大色块。

### 3.2 顶部与主图

- 头部：`.import-parsing-header`，高度 102px，三列 `70px / 1fr / 70px`。
- 返回按钮：`.import-parsing-back`，44px 热区，`ChevronLeft` 34px，颜色 `#171412`。
- 标题：`.import-parsing-title`，`正在整理菜谱`，24px/34px，700，居中。
- 主图：`.import-parsing-hero` 高 190px，宽度贴满 430px 容器；图片 `.import-parsing-hero-image` 使用本地裁图 `public/ui-concepts/import-parsing-hero.png`，`object-fit: cover`。
- 来源摘要：`.import-parsing-source`，左右 25px，距主图 25px，18px/28px，单行省略。格式为 `来自小红书 · 菜名或分享标题`，去掉短链和“小红书查看笔记”尾巴。

### 3.3 时间线

- 时间线根：`.import-parsing-timeline`，距来源 45px，左侧 marker 中心线 x≈80px，竖线 1px `#d8d1cc`。
- 单步：`.import-parsing-step`，`data-testid="import-parsing-step"`，四项固定：
  - `识别分享内容` / `已找到小红书链接`
  - `读取菜谱正文` / `已提取食材与做法`
  - `整理食材和步骤` / `AI 正在核对用量与顺序`
  - `筛选菜谱图片`
- 已完成：`.is-done`，48px 深墨色实心圆，白色 `Check`。
- 当前：`.is-current`，48px 圆，6px 珊瑚色进度环，内部 `LoaderCircle`。
- 未开始：灰色描边 `Circle`，标题颜色降为 `#8d8580`。
- 标题：`.import-parsing-step-title`，24px/34px，700；说明 `.import-parsing-step-description`，18px/28px。

### 3.4 提示与取消

- 提示组：`.import-parsing-hints`，距时间线约 80px，顶部虚线；两行 `.import-parsing-hint`：
  - `您的输入已自动保存`，`Cloud` 图标珊瑚色。
  - `通常需要 10-20 秒，请不要关闭页面`，`Clock3` 图标灰色。
- 取消：`.import-parsing-cancel`，文字 `取消解析`，19px/27px，700，底部 1px 下划线。
- 取消解析前必须 `window.confirm`；取消后回导入抽屉，保留输入；解析失败也回导入抽屉并显示错误。

## 4. 图片审核

参考：`docs/ui-concepts/04-image-review.png`

### 4.1 画布与根节点

- 页面路由：`/` 导入流程内部 `stage === "images"`。
- 根节点：`.image-review-page`，全屏流程页，左右 22px，底部为固定操作区预留 220px。
- 标题视觉文案：`选择菜谱图片`；为了旧流程测试兼容，可保留 `图片审核` 的 sr-only 文本。

### 4.2 顶部

- 头部：`.image-review-header`，最小高 130px，三列 `54px / 1fr / 86px`。
- 返回按钮：`.image-review-back`，`ChevronLeft` 34px。
- 标题：`.image-review-title`，24px/34px，700。
- 副标题：`.image-review-subtitle`，`保留真正有助于做菜的图片`，17px/25px，灰色。
- 计数：`.image-review-count`，格式 `{已选数} / {原图总数} 已选`，右对齐，17px/25px。

### 4.3 大图与缩略图

- 轮播变体：`ImageCarousel variant="imageReview"`。
- 根节点：`.image-review-carousel`。
- 大图框：`.image-review-main-frame`，圆角 6px，不放额外卡片；媒体区 `.image-review-main-media` 使用 `aspect-ratio: 1 / 1.14`；图片 `.image-review-main-image` 覆盖裁切。
- 封面标记：`.image-review-cover-badge`，左上角深墨半透明底，文字 `封面`。封面必须来自 `coverUrl`，不能用第一张隐式推断。
- 查看大图：`.image-review-fullscreen-button`，右上 38px 深色半透明按钮，`Maximize2` 图标。
- 缩略图：`.image-review-thumbnails` 横向滚动；单项 `.image-review-thumbnail` 为 72 × 94px。
- 选中态：`.is-selected`，2px 珊瑚色边框，右上 `.image-review-thumbnail-check` 珊瑚圆形勾。
- 未选态：`.is-muted`，仅降低透明度到 0.45，不删除、不重排。
- 缩略图仍显示全部 `imageUrls`；`filterImages` 的结果只决定初始 `selectedUrls` 和初始 `coverUrl`。

### 4.4 操作区

- 图片操作：`.image-review-actions`，顶部分割线，两列；按钮 `.image-review-action`，包含 `Star` + `设为封面`、`Trash2` + `取消选择/恢复选择`。
- 推荐说明：`.image-review-note`，文案 `AI 已推荐 N 张，你可以继续调整`，居中灰色。
- 固定底部：`.image-review-footer`，`z-40`，半透明暖白背景，顶部发丝线。
- 主按钮：`.image-review-submit`，文案 `确认图片（N）`，50px 高，深墨色，4px 圆角。
- 次按钮：`.image-review-empty`，文案 `无图保存`。
- 删除或取消当前图后必须自动定位到最近仍选中的图片；全部取消后显示 `0 / 总数 已选` 并允许无图保存。

## 5. 菜谱确认

参考：`docs/ui-concepts/05-recipe-confirm.png`

### 5.1 画布与根节点

- 页面路由：`/` 导入流程内部 `stage === "confirm"`。
- 根节点：`.recipe-confirm-page`，全屏流程页，左右 17px，底部为固定保存区预留 174px。
- 表单根：`.recipe-confirm-form`，`data-testid="recipe-confirm-form"`。
- 出现时隐藏全局 `.bottom-nav`，不得出现旧式玻璃卡片。

### 5.2 顶部与摘要

- 顶部：`.recipe-confirm-header`，高度 102px，三列 `76px / 1fr / 82px`。
- 返回按钮：`.recipe-confirm-back`，`ChevronLeft` 34px。
- 标题：`.recipe-confirm-title`，`确认菜谱`，23px/32px，700。
- 保存草稿：`.recipe-confirm-draft-button`，右对齐，17px/25px。
- 摘要：`.recipe-confirm-summary`，左图右文，列间距 15px。
- 封面：`.recipe-confirm-cover`，比例约 1.88:1，圆角 4px，图片 `.recipe-confirm-cover-image`。
- 菜名：`.recipe-confirm-name`，仍是可编辑 input，30px/42px，宋体/Georgia 风格，700。
- 菜名编辑按钮：`.recipe-confirm-edit-button`，视觉图标约 21px；点击必须聚焦并选中 `.recipe-confirm-name`，不能只是静态图标。
- 元信息：`.recipe-confirm-meta`，格式 `分类 · 难度中文 · N 分钟`，17px/25px，单行。

### 5.3 标签与食材

- Tab：`.recipe-confirm-tabs`，三列 `概览 / 食材 / 步骤`；当前项 `.is-active` 使用 36px 珊瑚色下划线。点击 tab 必须更新 `aria-selected` 和 `.is-active`，并滚动到对应分区。
- 分区标题：`.recipe-confirm-section-title`，21px/30px，700；右侧编辑按钮 `.recipe-confirm-section-edit-button` 内含图标 `.recipe-confirm-section-icon`，必须能触发对应编辑动作或聚焦对应输入。
- 标签区：`.recipe-confirm-tags`，标签 `.recipe-confirm-tag` 使用细边框小矩形；加号 `.recipe-confirm-tag-add` 点击后必须能添加标签，不能无反馈。
- 食材区根：`.recipe-confirm-ingredients`。
- 食材列表：`.recipe-confirm-ingredient-list`，按设计稿首屏高度裁切；DOM 中仍保留完整可编辑项；点击查看全部后增加 `.is-expanded`，取消高度裁切。
- 食材行：`.recipe-confirm-ingredient-row` 必须同时保留 `grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` 以保证长用量换行和旧测试兼容。
- 名称：`.recipe-confirm-ingredient-name`；用量：`.recipe-confirm-ingredient-amount resize-none`，两列底线式输入；默认单行高度必须一致，左右底线在同一水平线上。
- 行操作：`.recipe-confirm-ingredient-actions col-span-2 flex justify-end`，包含上移、下移、删除，但默认必须同时带 `.recipe-confirm-layout-hidden`，只保留可访问/可测试能力，不进入视觉布局流，也不能拦截真实点击。
- 新增食材/调料按钮 `.recipe-confirm-add-line` 默认也必须带 `.recipe-confirm-layout-hidden`，不能在预览态露出 `添加食材 / 添加调料` 文案。
- 查看全部：`.recipe-confirm-more`，折叠态格式 `查看全部 N 项`；点击后展开并变为可收起状态。

### 5.4 步骤与固定保存

- 步骤分区：`.recipe-confirm-steps`。
- 步骤列表：`.recipe-confirm-step-list`，视觉上展示前两步高度；DOM 保留完整可编辑项；点击查看全部后增加 `.is-expanded`，取消高度裁切。
- 步骤行：`.recipe-confirm-step`，列为序号、正文、操作。
- 序号：`.recipe-confirm-step-order`，`01 / 02 / 03`，34px italic serif。
- 正文：`.recipe-confirm-step-text`，textarea，18px/31px。
- 操作：`.recipe-confirm-step-actions` 只允许视觉展示拖拽提示 `.recipe-confirm-step-grip`；上移、下移、删除按钮必须带 `.recipe-confirm-layout-hidden`，不能撑高步骤行。
- 添加步骤按钮 `.recipe-confirm-add-line` 默认必须带 `.recipe-confirm-layout-hidden`，不能在预览态露出 `添加步骤`。
- 查看全部：`.recipe-confirm-more`，折叠态格式 `查看全部 N 步`；点击后展开并变为可收起状态。
- 固定底部：`.recipe-confirm-footer`，`z-40`，顶部发丝线，半透明暖白。
- 保存提示：`.recipe-confirm-save-hint`，文案 `请确认食材用量后再保存`，前置珊瑚色圆点。
- 主按钮：`.recipe-confirm-submit`，50px 高，深墨色，4px 圆角；禁用态 `#c9c2be`。
- 菜名为空或步骤为空时禁止保存；保存失败显示 `.recipe-confirm-error`；保存成功跳转详情页。

## 6. 菜谱列表

参考：`docs/ui-concepts/06-recipe-list.png`

### 结构

1. 标题“我的菜谱”、数量、搜索和管理。
2. 底线式搜索框。
3. 文字筛选标签和筛选入口。
4. 第一条重点菜谱使用大图。
5. 其余菜谱使用缩略图列表。
6. 双栏底部导航。

### 规则

- 不使用统一卡片墙。
- 第一条可突出展示，其余保持紧凑。
- 菜谱之间使用发丝线分隔。
- 元数据顺序统一：分类、难度、用时、做过次数、评分。
- 搜索实时按菜名过滤。
- 分类、标签和难度放入筛选抽屉。
- 管理入口必须可见，长按只作为快捷方式。
- 删除模式显示多选状态和固定操作栏。

## 7. 菜谱详情

参考：`docs/ui-concepts/07-recipe-detail.png`

### 结构

1. 大幅菜品图片。
2. 返回、编辑和更多操作。
3. 菜名、分类、难度、用时、做过次数和评分。
4. “备料 / 步骤”文字标签。
5. 可勾选食材列表。
6. 大号步骤序号和步骤正文。
7. 查看复盘和标记做过的固定操作栏。

### 规则

- 详情页优先支持做菜阅读，不使用装饰卡片。
- 图片支持全屏查看和左右切换。
- 食材名称和用量左右对齐。
- 食材勾选只表示当前做菜进度，不修改菜谱数据。
- 备料与步骤切换采用锚点滚动或内容切换。
- “标记做过”始终可发现，不完全隐藏。
- 删除放在更多菜单中，并二次确认。

### 1:1 实施规格

- 根节点：`.recipe-detail-page`，抵消 `AppShell` 横向 padding，背景 `#fffaf7`，底部为固定操作栏预留 `132px + safe-area`。
- 顶部图：`.recipe-detail-hero` / `.recipe-detail-hero-image`，全宽 `430px` 基准，高约 `306px`，`object-fit: cover`，不加暗色遮罩；顶部操作直接浮在图上。
- 顶部操作：`.recipe-detail-topbar`，y≈55px，左右 16px；返回 `ChevronLeft` 36px，编辑 `PencilLine` 30px，更多 `Ellipsis` 31px，点击热区均 `44px`。
- 内容边距：`.recipe-detail-content` 左右 `clamp(23px, 5.8vw, 25px)`。
- 菜名：`.recipe-detail-title`，宋体感字体，37px/1.18，颜色 `#24201e`。
- 元信息：`.recipe-detail-meta`，格式固定为 `分类 · 难度 · 用时 · 做过 N 次`，16px/24px，颜色 `#706965`。
- 评分：`.recipe-detail-rating`，`老婆评分` + 珊瑚色数字，16px/24px。
- 标签切换：`.recipe-detail-tabs`，两列文字按钮，选中项 `.is-active` 底部 2px 珊瑚线。
- 食材行：`.recipe-detail-prep-row`，底部发丝线；`.recipe-detail-prep-label` 三列：圆形 checkbox、名称、右对齐用量。
- 步骤：`.recipe-detail-step-number` 使用 italic serif 46px；正文 `.recipe-detail-step-text` 为 17px/29px；步骤图片 `.recipe-detail-step-image` 圆角 6px。
- 底部操作栏：`.recipe-detail-action-bar` 固定底部，隐藏详情页全局 `.bottom-nav`；左侧 `.recipe-detail-review-button`，右侧 `.recipe-detail-cooked-button` 深墨色按钮。

## 8. 做菜复盘

参考：`docs/ui-concepts/08-cook-review.png`

### 结构

1. 详情页背景和底部抽屉。
2. 标题“这次做得怎么样？”。
3. 五星评分和评分文字。
4. 老婆评价。
5. 下次改进快捷标签和文字输入。
6. 做菜时间。
7. 固定“保存复盘”按钮。

### 规则

- 使用星形图标，不使用 emoji 评分。
- 珊瑚色只用于已选星星和快捷标签边框。
- 快捷标签使用细边框，不使用填充胶囊。
- 至少填写评分或一项文字内容后才能保存。
- 保存后清空表单、关闭抽屉、做过次数加一。
- 成功只显示短 Toast，不播放全屏庆祝动画。

### 1:1 实施规格

- 抽屉容器：`BottomSheet variant="review"` 输出 `.bottom-sheet-review`，430px 基准高度约 584px，顶部圆角 16px，纯白背景，无阴影装饰。
- 拖动条：`.bottom-sheet-handle`，46px × 3px，灰色 `#d8d8d8`，位于抽屉顶部居中。
- 标题：`.bottom-sheet-title`，`这次做得怎么样？`，23px/32px，字重 700；关闭按钮为 44px 热区，`X` 图标 25px。
- 表单根：`.cook-review-form`；副标题 `.cook-review-lead` 为 15px/22px，颜色 `#7a706c`。
- 评分：`.cook-review-stars` 五个 `Star`，图标 40px，已选填充 `#ff5f52`；评分文字 `.cook-review-rating-label` 居中。
- 老婆评价：`.cook-review-feedback`，标题、提示 `她怎么说？` 和单行底线式 textarea，不使用填充输入框。
- 下次改进：`.cook-review-tags` 四个细边框标签：`少盐`、`火小一点`、`时间短一点`、`再辣一点`；`.is-selected` 只改边框色为珊瑚色，不填充。
- 改进文字：`.cook-review-improvement-textarea`，与快捷标签合并提交到 `husbandImprovementNotes`，用中文逗号连接。
- 做菜时间：`.cook-review-time-row` 显示当前 `今天 HH:mm`，只用于展示，不把 `cookedAt` 塞入提交 payload。
- 保存按钮：`.cook-review-submit`，48px 高，4px 圆角，深墨色；禁用态使用 `#c9c2be`。

## 9. 页面流转

```text
首页
→ 导入抽屉
→ 解析进度
→ 图片审核
→ 菜谱确认
→ 菜谱详情
→ 做菜复盘

首页
→ 菜谱列表
→ 菜谱详情
```

返回规则：

- 导入抽屉关闭后回到首页。
- 解析取消或失败后回到导入抽屉。
- 图片审核返回解析结果，不重复请求。
- 菜谱确认返回图片审核，并保留编辑内容。
- 菜谱详情返回原列表滚动位置。

## 10. Agent 实施要求

- 以 8 张参考图为视觉优先级，不自行增加新的视觉风格。
- 全部页面复用 `global-style.md` 中的令牌和基础组件。
- 不增加独立“分类”底部导航；分类进入菜谱筛选。
- 不新增 UI 依赖，继续使用现有 Lucide 图标和 Framer Motion。
- 保留现有业务能力、API 和数据库行为。
- 可拆分组件，但不得为单一用途创建多层抽象。
- 所有关键状态必须具备：初始、加载、成功、空、错误、禁用。
- 375px、390px、430px 宽度下不得出现横向滚动、文字遮挡或固定栏覆盖内容。
- 完成后使用 Playwright 对照参考图检查首页、列表、详情和复盘抽屉。

## 11. 验收清单

- [ ] 页面背景为纯暖白，无全局渐变。
- [ ] 页面主体没有毛玻璃卡片墙。
- [ ] 珊瑚色占比不超过 5%。
- [ ] 主按钮统一为深墨色。
- [ ] 圆角主要为 6–8px。
- [ ] 页面分区主要依赖留白和发丝线。
- [ ] 底部导航只有“导入、菜谱”。
- [ ] 首页导入使用操作行和底部抽屉。
- [ ] 列表不是统一卡片网格。
- [ ] 详情食材和步骤适合做菜时快速扫描。
- [ ] 复盘使用星级和底部抽屉。
- [ ] 所有页面适配 375px 至 430px。
