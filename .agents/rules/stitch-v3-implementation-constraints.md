# Stitch V3 实施硬约束

> 本文件是 Stitch V3 实现 agent、修正 agent 和 reviewer 的强制输入。违反“必须”条款属于 Important 或 Critical 问题，当前 Task 不得通过。

## 1. 视觉与业务基准

- Stitch 第三版 `.stitch/designs/`、`.stitch/design-system.json` 和 `resources/style-guide.json` 是唯一视觉基准。
- 根目录 `DESIGN.md` 与早期概念图仅作为历史资料，发生冲突时不得覆盖 Stitch 第三版。
- 必须保留现有 Next.js、API、SQLite 和真实业务数据流，禁止把 Stitch 静态 HTML 当成独立页面直接嵌入。
- 所有在第三版中可见的控件必须具备真实交互；收藏、计时、步骤进度和语音播报不得只做视觉占位。

## 2. shadcn/ui 优先规则

通用 UI 原语必须优先使用 shadcn/ui，不得从零重写等价组件。

| 需求 | 必须优先使用 |
| --- | --- |
| 普通、主要、次要、图标按钮 | `Button` + `cva` variant |
| 单行输入 | `Input` |
| 多行输入 | `Textarea` |
| 标签与表单说明 | `Label` |
| 勾选状态 | `Checkbox` |
| 食材 / 步骤、菜谱 / 分类切换 | `Tabs` |
| 移动端底部抽屉 | `Drawer`，只有无法满足动效或键盘要求时才能申请例外 |
| 普通模态层 | `Dialog` |
| 删除等破坏性确认 | `AlertDialog` |
| 更多操作 | `DropdownMenu` |
| 加载占位 | `Skeleton` |
| 全局提示 | `Sonner` / shadcn `Toaster` |

- `src/components/ui/` 只放 shadcn/ui 原语及其主题化变体。
- 业务包装组件放在 `src/components/`，通过组合 shadcn/ui 原语实现，不得复制一份 Button、Dialog、Drawer 或 Toast 内核。
- 新增普通 `<button>`、`<input>`、`<textarea>`、手写焦点陷阱、手写 Portal 或手写模态遮罩，reviewer 必须先按违规检查。
- 确有例外时，代码附近必须写 `shadcn-exception:` 注释并说明技术原因；reviewer 必须验证 shadcn/ui 确实不能满足需求。
- 只有基础 Task 可以执行 shadcn 初始化和批量增加依赖；后续 agent 未经主控同意不得自行安装组件库或替换基础方案。

## 3. 允许自定义的业务组件

以下组件属于产品特有组合，可以自定义，但内部通用控件仍应使用 shadcn/ui：

- 菜谱列表行和首页最近做过列表
- 圆形菜品 Hero 与图片审核画廊
- 横向备料轨道
- 菜谱步骤时间线
- 做菜计时器与步骤进度协调器
- 语音播报控制器
- 双栏悬浮底部导航

自定义组件必须有清晰 Props 类型、单一职责和定向测试，禁止把整页写成一个超大组件。

## 4. 图标与图片

- 常规界面图标必须优先使用 `lucide-react`，包括返回、搜索、收藏、更多、加减、计时、导入、书本和关闭。
- 禁止使用 emoji、在线 Material Symbols 字体、混用多个图标库或随手手绘 SVG。
- 只有 Lucide 中不存在且属于产品独特视觉语言的图形，才允许生成切图；生成资源必须本地化、压缩并记录来源和用途。
- 菜品和食材图片从 `.stitch/assets/manifest.json` 选择并迁入生产目录，禁止生产代码继续依赖临时 Stitch 托管 URL。

## 5. Apple Design 动效

- 触控反馈必须从 pointer-down 开始，普通按钮按下缩放建议为 `0.98`。
- 可触摸、可拖拽的交互使用 Framer Motion / Motion spring，必须从当前呈现值继续并允许中断。
- 抽屉必须跟手、可反向、可根据速度决定关闭或归位，禁止只使用固定时长 keyframes 模拟拖拽。
- 默认动效使用无过冲、接近临界阻尼的 spring；只有手势带来动量时允许轻微回弹。
- 必须支持 `prefers-reduced-motion`；大位移和弹簧降级为短淡入淡出或静态反馈。
- 毛玻璃必须支持高不透明度回退，并处理底部安全区。

## 6. 样式约束

- 颜色、字号、间距和圆角从 `resources/style-guide.json` 映射到 Tailwind / CSS variables。
- 业务组件中禁止新增任意十六进制颜色；确需新 token 时先更新样式指南并由主控批准。
- 参考宽度为 390px，同时必须通过 375px 和 430px 验收。
- 所有触控目标至少 44 x 44px。
- 固定栏和抽屉必须处理 `safe-area-inset-bottom`、软键盘、长文本和无横向溢出。

## 7. Agent 范围控制

- 每个实现 agent 只读取自己的 task brief、相关 Stitch HTML/截图和直接依赖文件，禁止要求其读取整个对话历史。
- agent 只能修改 brief 列出的文件范围；发现跨 Task 问题时写入报告，不得顺手大规模重构。
- 禁止多个实现 agent 并行写代码。主控与子 agent 总并发不得超过 4。
- agent 必须先写失败测试，再写实现，并在报告中记录 RED、GREEN 和回归命令。
- agent 不得自行宣布最终完成；只有 reviewer 与主控验收均通过后 Task 才能完成。

## 8. Reviewer 强制检查

Reviewer 必须同时检查：

1. 是否错误地从零实现了已有 shadcn/ui 原语。
2. 是否新增了未说明的原生按钮、输入、模态层、焦点管理或 Toast。
3. 是否使用 Lucide 之外的普通界面图标或远程图片 URL。
4. 是否破坏键盘操作、ARIA、焦点可见性或 44px 触控目标。
5. 动效是否可中断并有 reduced-motion 降级。
6. 所有可见控件是否真实可用。
7. 定向测试是否覆盖本 Task 的新增行为。

任何一项不满足都必须记录在 review 中并退回修正；未经用户明确接受，不能作为“已知差异”跳过。

## 9. 类型、数据与可靠性

- 新增代码禁止使用 `any`；修改到的旧 DTO、数据库 row 和 API 映射必须补齐类型，但不得为此扩大到无关全仓库重构。
- API 请求、查询参数和关键响应使用 Zod；错误统一为 `{ error: { code, message } }`，客户端必须兼容非 JSON 失败响应。
- 可被新请求替代的网络调用使用 `AbortController`，组件卸载时取消请求。
- 数据库迁移必须增量、幂等并保留用户数据；多表写入必须使用 transaction，测试使用独立临时数据库。
- 数据库和服务密钥只存在于服务器边界；禁止 `dangerouslySetInnerHTML`，导入 URL 和图片 URL 必须校验允许协议。
- 复杂流程使用 reducer 或明确状态模型；页面组件负责编排，计时、语音、收藏和导入副作用进入独立 hook 或 service。
- 计时器以绝对时间为真实状态，必须处理暂停、后台、锁屏、恢复和清理；测试使用 fake timers。
- 语音必须由用户触发、检测浏览器能力，并在切换步骤、退出和卸载时取消；不支持时正常降级。
- 所有异步界面必须覆盖 loading、empty、error、disabled 和 retry，失败时保留可恢复的用户输入。

## 10. 测试与范围控制

- 测试优先通过 role、label 和用户行为断言，只有缺少稳定语义入口时才使用 `data-testid`；禁止用大面积 snapshot 代替行为测试。
- 不提前堆叠 `memo`、`useMemo` 或 `useCallback`；只有验证到实际重渲染问题时才优化。
- 旧代码只在本 Task 触及范围内整改，禁止借新版 UI 顺手清理无关模块。
- 跨项目组件库、脚手架和自进化机制不属于当前实施范围，项目最终通过后再根据真实复用证据评估。
