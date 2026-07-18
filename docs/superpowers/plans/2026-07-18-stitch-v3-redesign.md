# 老公菜谱 Stitch V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有菜谱导入和 SQLite 数据流的前提下，以 Stitch 第三版 1:1 重构 10 个 H5 屏幕，并交付真实收藏、计时、步骤进度和语音播报。

**Architecture:** Next.js route 和 API 保持服务器边界，浏览器交互由小型 screen coordinator、reducer 和 hooks 管理；业务组件组合 shadcn/ui 原语，Framer Motion 只承担可中断的 Apple 风格动效。五个实现 Task 串行推进，每个 Task 经规格审查、质量审查和主控验收后再进入下一项，最后单独执行完整 E2E、三尺寸视觉对照和验收报告。

**Tech Stack:** Next.js 14、React 18、TypeScript strict、Tailwind CSS 3、shadcn/ui、Radix UI、Vaul Drawer、Framer Motion 11、Lucide React、Zod 3、better-sqlite3 9、Vitest、Testing Library、Playwright。

## Global Constraints

- `.stitch/designs/`、`.stitch/design-system.json` 和 `resources/style-guide.json` 是唯一视觉基准。
- 根目录 `DESIGN.md` 与旧版概念图仅作历史资料，不得覆盖 Stitch V3。
- 通用交互必须优先使用 `.agents/rules/stitch-v3-implementation-constraints.md` 指定的 shadcn/ui 原语。
- 业务代码禁止新增 `any`；修改到的旧数据映射同时补齐类型。
- 常规图标只使用 `lucide-react`；生产代码不得使用 Stitch 远程图片 URL。
- 390px 是视觉基准，375px 和 430px 必须通过响应式验收。
- 所有触控目标至少 44 x 44px，并处理安全区、键盘、长文本和 reduced motion。
- 收藏、计时、步骤进度和语音播报必须真实可用，不得只做静态展示。
- 默认只允许一个实现 agent 写代码；主控加子 agent 总并发不超过 4。
- 每个 Task 必须先 RED、再 GREEN，并经过规格审查和质量审查；Important 或 Critical 问题必须退回修正。
- 不在本轮抽取跨项目组件库或脚手架；项目完成后再根据真实复用证据评估。
- 任何现有未跟踪设计产物和输出目录都不得回滚或清理。

---

## File Map

### Shared foundation

- `components.json`：shadcn/ui CLI 配置和别名。
- `src/lib/utils.ts`：shadcn `cn()` 工具。
- `src/lib/motion.ts`：共享 Apple 风格 spring、按压反馈和 reduced-motion 配置。
- `src/components/ui/*.tsx`：shadcn/ui 原语及主题 variant，不放业务逻辑。
- `src/app/globals.css`：Stitch token、基础排版、屏幕级稳定 class 和响应式规则。
- `tailwind.config.ts`：只暴露语义 token，不在组件中新增十六进制颜色。
- `src/components/bottom-sheet.tsx`：业务兼容包装，内部使用 shadcn `Drawer`。
- `src/components/toast.tsx`：过渡期 Sonner adapter，最终所有提示由 Sonner 渲染。

### Home and recipe list

- `src/lib/domain/recipe-api.ts`：RecipeSummary、RecipeDetail 和 API response 的 Zod contract。
- `src/lib/http/api-error.ts`：统一 `{ error: { code, message } }` schema 和客户端错误提取。
- `src/lib/http/api-response.ts`：API route 使用的统一错误响应 helper。
- `src/components/home/home-screen.tsx`：首页布局和导入入口。
- `src/components/home/recent-recipes.tsx`：最近做过的 loading、empty、error 和列表状态。
- `src/components/recipe-list.tsx`：列表查询、筛选、删除模式和状态恢复协调器。
- `src/components/recipe-card.tsx`：Stitch V3 菜谱行。
- `src/components/bottom-nav.tsx`：双栏悬浮导航。

### Import flow

- `src/components/import/import-flow-machine.ts`：导入状态、事件和纯 reducer。
- `src/components/import/import-sheet.tsx`：导入 Drawer 内容。
- `src/components/import/parsing-progress.tsx`：四阶段解析进度。
- `src/components/import/image-review-screen.tsx`：图片选择和封面审核。
- `src/components/import-flow.tsx`：只编排 API 副作用和各阶段屏幕。
- `src/components/recipe-confirm-form.tsx`：菜谱确认编辑表单。
- `src/components/image-carousel.tsx`：详情轮播和图片审核画廊共享展示逻辑。

### Detail, favorite, and review

- `src/lib/db/schema.ts`：增量增加 `recipes.is_favorite`。
- `src/lib/db/recipe-repository.ts`：类型化 row 映射和幂等收藏写入。
- `src/app/api/recipes/[id]/favorite/route.ts`：收藏 PATCH API。
- `src/lib/http/api-client.ts`：Zod response 解析、统一错误和 `AbortSignal`。
- `src/components/recipe/favorite-button.tsx`：可回滚的收藏交互。
- `src/components/recipe-detail.tsx`：详情页面协调器。
- `src/components/cooking-log-sheet.tsx`：基于 shadcn Drawer 的复盘表单。

### Cooking session

- `src/lib/domain/cooking-session.ts`：会话 schema、状态、事件和 reducer。
- `src/hooks/use-cooking-session.ts`：sessionStorage 持久化和会话操作。
- `src/hooks/use-cooking-timer.ts`：绝对截止时间计时和可见性校准。
- `src/hooks/use-speech-narration.ts`：Web Speech 能力检测、播放和取消。
- `src/components/cooking/cooking-guide-drawer.tsx`：进入做菜指引。
- `src/components/cooking/cooking-timer.tsx`：计时显示和控制。
- `src/components/cooking/ingredient-rail.tsx`：横向备料轨道。
- `src/components/cooking/step-timeline.tsx`：步骤完成、撤销和播报控制。
- `src/components/cooking/cooking-mode.tsx`：做菜模式页面协调器。
- `src/app/recipes/[id]/cook/page.tsx`：做菜模式路由。

### Verification

- `tests/unit/stitch-v3-foundation.test.tsx`：token、shadcn 原语、Drawer 和 motion 降级。
- `tests/unit/home-v3.test.tsx`：首页状态和导航。
- `tests/unit/recipe-list-v3.test.tsx`：列表搜索、筛选、收藏展示和管理模式。
- `tests/unit/import-flow-v3.test.tsx`：导入 reducer 和四阶段流程。
- `tests/unit/recipe-detail-v3.test.tsx`：详情、收藏、Tabs、指引和复盘入口。
- `tests/unit/cooking-session.test.ts`：会话 reducer 和恢复。
- `tests/unit/cooking-timer.test.tsx`：fake timer 和后台校准。
- `tests/unit/speech-narration.test.tsx`：语音检测、播放、取消和降级。
- `tests/unit/cooking-mode.test.tsx`：做菜模式组合交互。
- `tests/e2e/mobile-flow.spec.js`：10 屏、真实功能和 30 张三尺寸截图。
- `docs/qa/最终验收报告.md`：最终证据和 Claude Code 复验说明。

---

### Task 1: Stitch token、shadcn/ui 与应用壳

**Files:**

- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/lib/motion.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/checkbox.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/drawer.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/alert-dialog.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/sonner.tsx`
- Create: `tests/unit/stitch-v3-foundation.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/bottom-sheet.tsx`
- Modify: `src/components/page-transition.tsx`
- Modify: `src/components/skeleton-card.tsx`
- Modify: `src/components/toast.tsx`

**Interfaces:**

- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`.
- Produces: `appleSpring`, `pressMotion`, `fadeMotion(reduced: boolean)` from `@/lib/motion`.
- Produces: shadcn primitives imported from `@/components/ui/<name>`.
- Produces: existing `BottomSheet` props remain `{ open, title, children, onClose, variant? }`, but implementation delegates focus, portal and drag to `Drawer`.

- [ ] **Step 1: Record the baseline before dependency changes**

Run:

```bash
git status --short
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
```

Expected: existing test suite and build pass. If either fails, record the exact pre-existing failure in `progress.md` before touching dependencies.

- [ ] **Step 2: Write the failing foundation tests**

Create `tests/unit/stitch-v3-foundation.test.tsx` with these contracts:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";

describe("Stitch V3 foundation", () => {
  it("exposes the shadcn button with a 44px touch target", () => {
    render(<Button aria-label="收藏">收藏</Button>);
    expect(screen.getByRole("button", { name: "收藏" })).toHaveClass("min-h-11");
  });

  it("closes the Drawer wrapper and restores the trigger contract", () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="导入菜谱" onClose={onClose}>内容</BottomSheet>);
    expect(screen.getByRole("dialog", { name: "导入菜谱" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run the new test and verify RED**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/stitch-v3-foundation.test.tsx
```

Expected: FAIL because `@/components/ui/button` does not exist and BottomSheet is still the handwritten modal.

- [ ] **Step 4: Initialize shadcn/ui once and add the approved primitives**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npx shadcn@latest init -d
PATH=/Users/mie/.hermes/node/bin:$PATH npx shadcn@latest add button input textarea label checkbox tabs drawer dialog alert-dialog dropdown-menu skeleton sonner
```

Expected: `components.json`, `src/lib/utils.ts`, `src/components/ui/*.tsx` and the required Radix, Vaul, CVA, clsx, tailwind-merge and Sonner dependencies exist. Inspect every generated diff; retain the existing `@/*` alias and Tailwind 3 setup.

- [ ] **Step 5: Map Stitch tokens and shared motion**

Replace the root token block with the semantic values below and expose matching Tailwind colors:

```css
:root {
  --canvas: 40 33% 97%;
  --surface: 0 0% 100%;
  --surface-low: 20 73% 96%;
  --surface-container: 20 82% 94%;
  --ink: 60 3% 12%;
  --on-surface: 26 28% 11%;
  --on-surface-variant: 26 21% 28%;
  --divider: 40 13% 90%;
  --track: 40 13% 94%;
  --primary: 25 66% 52%;
  --destructive: 4 46% 49%;
  --success: 140 23% 39%;
  --radius: 0.5rem;
  --app-max-width: 430px;
  --app-gutter: 20px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

Create `src/lib/motion.ts`:

```ts
export const appleSpring = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const;
export const pressMotion = { scale: 0.98 } as const;
export function fadeMotion(reduced: boolean) {
  return reduced ? { duration: 0.01 } : { duration: 0.16, ease: "easeOut" as const };
}
```

Keep screen-specific styles under named V3 classes. Do not copy generated Tailwind utility strings from Stitch into one monolithic component.

- [ ] **Step 6: Replace handwritten primitives with shadcn adapters**

Implement `BottomSheet` using `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle` and `Button`; preserve the public props so existing screens keep working during migration. Mount `<Toaster position="top-center" richColors />` once in `src/app/layout.tsx`. Implement `SkeletonCard` using `Skeleton`, and make the existing `Toast` component a temporary Sonner adapter:

```tsx
export function Toast({ message }: { message: string }) {
  const previous = useRef("");
  useEffect(() => {
    if (message && message !== previous.current) toast(message);
    previous.current = message;
  }, [message]);
  return null;
}
```

Update `PageTransition` to use `fadeMotion` and no spatial movement when reduced motion is enabled.

- [ ] **Step 7: Run foundation and regression checks**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/stitch-v3-foundation.test.tsx tests/unit/v2-shell.test.tsx tests/unit/cooking-log-sheet.test.tsx
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
rg -n "<button|<input|<textarea|role=\"dialog\"" src/components/ui src/components/bottom-sheet.tsx src/components/skeleton-card.tsx
git diff --check
```

Expected: all tests and build pass; raw elements inside generated shadcn primitives are expected, while `bottom-sheet.tsx` and `skeleton-card.tsx` contain no handwritten modal or form primitive.

- [ ] **Step 8: Review, repair, and commit Task 1**

Dispatch one specification reviewer and one code-quality reviewer. Return all Important or Critical findings to the Task 1 implementer, rerun Step 7, then commit only Task 1 files:

```bash
git add components.json package.json package-lock.json tailwind.config.ts src/app/globals.css src/app/layout.tsx src/lib/utils.ts src/lib/motion.ts src/components/ui src/components/app-shell.tsx src/components/bottom-sheet.tsx src/components/page-transition.tsx src/components/skeleton-card.tsx src/components/toast.tsx tests/unit/stitch-v3-foundation.test.tsx progress.md docs/qa/最终验收报告.md
git commit -m "feat: establish Stitch V3 UI foundation"
```

---

### Task 2: 首页、菜谱列表与导航

**Files:**

- Create: `src/lib/domain/recipe-api.ts`
- Create: `src/lib/http/api-error.ts`
- Create: `src/lib/http/api-response.ts`
- Create: `src/components/home/home-screen.tsx`
- Create: `src/components/home/recent-recipes.tsx`
- Create: `tests/unit/home-v3.test.tsx`
- Create: `tests/unit/recipe-list-v3.test.tsx`
- Modify: `src/lib/http/api-client.ts`
- Modify: `src/app/api/recipes/route.ts`
- Modify: `src/components/import-flow.tsx`
- Modify: `src/components/recipe-list.tsx`
- Modify: `src/components/recipe-card.tsx`
- Modify: `src/components/bottom-nav.tsx`
- Modify: `src/app/globals.css`
- Copy: `.stitch/assets/stitch-image-*.jpg` to `public/stitch-v3/`
- Remove after equivalent V3 coverage exists: `tests/unit/recipe-list-v2.test.tsx`
- Remove after equivalent V3 coverage exists: `tests/unit/v2-shell.test.tsx`

**Interfaces:**

- Produces: `RecipeSummarySchema`, `RecipeDetailSchema`, `RecipeListResponseSchema`, `RecipeDetailResponseSchema` and inferred types.
- Produces: `HomeScreenProps = { recent: AsyncState<RecipeSummary[]>; onImport(): void; onRetry(): void }`.
- Produces: `listRecipesApi(params, signal?) => Promise<{ recipes: RecipeSummary[] }>`.
- Consumes: Task 1 `Button`, `Input`, `Drawer`, `DropdownMenu`, `Skeleton` and motion tokens.

- [ ] **Step 1: Write failing typed API and screen tests**

Create tests that assert response typing, Stitch V3 copy and accessible controls:

```tsx
it("shows the V3 home and opens import from the primary entry", async () => {
  render(<ImportFlow />);
  expect(screen.getByRole("heading", { name: "老公菜谱" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导入新菜谱" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "导入新菜谱" }));
  expect(await screen.findByRole("dialog", { name: "导入菜谱" })).toBeInTheDocument();
});

it("normalizes a legacy list response to an explicit favorite state", () => {
  const parsed = RecipeListResponseSchema.parse({ recipes: [summaryWithoutFavorite] });
  expect(parsed.recipes[0]?.isFavorite).toBe(false);
});
```

Also retain old behavior coverage for search, category, difficulty, long press management, real delete, empty/error/retry and scroll restoration.

- [ ] **Step 2: Verify RED**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/home-v3.test.tsx tests/unit/recipe-list-v3.test.tsx
```

Expected: FAIL because the V3 components and typed API contracts do not exist.

- [ ] **Step 3: Add Zod API contracts and remove touched `any`**

Create `src/lib/domain/recipe-api.ts` with these stable fields:

```ts
export const RecipeSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  mainCategory: z.string(),
  coverImageUrl: z.string().nullable(),
  cookedCount: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().positive().nullable(),
  difficulty: z.string(),
  tags: z.array(z.string()),
  latestWifeFeedback: z.string(),
  wifeRating: z.number().min(0).max(5),
  isFavorite: z.boolean().default(false)
});
export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;
export const RecipeListResponseSchema = z.object({ recipes: z.array(RecipeSummarySchema) });
export const RecipeIngredientApiSchema = z.object({ name: z.string(), amount: z.string(), type: z.string() });
export const RecipeStepApiSchema = z.object({ order: z.number().int().positive(), text: z.string(), imageUrl: z.string().nullable() });
export const CookingLogApiSchema = z.object({
  id: z.number().int().positive(),
  cookedAt: z.string(),
  wifeFeedback: z.string(),
  wifeRating: z.number().min(0).max(5),
  husbandImprovementNotes: z.string(),
  notes: z.string()
});
export const RecipeDetailSchema = RecipeSummarySchema.extend({
  sourcePlatform: z.string(),
  sourceUrl: z.string(),
  originalTitle: z.string(),
  shareText: z.string(),
  tips: z.string(),
  imageUrls: z.array(z.string()),
  ingredients: z.array(RecipeIngredientApiSchema),
  seasonings: z.array(RecipeIngredientApiSchema),
  steps: z.array(RecipeStepApiSchema),
  cookingLogs: z.array(CookingLogApiSchema)
});
export const RecipeDetailResponseSchema = z.object({ recipe: RecipeDetailSchema });
```

Extend the same file with cooking log and detail schemas matching `RecipeDetail` in the approved specification; use the same defaulted `isFavorite` during the pre-migration Tasks. Change `requestJson` to accept a Zod schema, tolerate non-JSON error bodies, and accept an optional `AbortSignal`. Create `api-error.ts` with `ApiErrorResponseSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })` and `api-response.ts` with `apiError(code, message, status)`. Validate GET query values with a Zod schema in `src/app/api/recipes/route.ts` and return the uniform error body on invalid input.

- [ ] **Step 4: Build the V3 home composition**

Move home-only rendering from `ImportFlow` into `HomeScreen` and `RecentRecipes`. `ImportFlow` supplies callbacks and async state only:

```ts
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export type HomeScreenProps = {
  recent: AsyncState<RecipeSummary[]>;
  onImport: () => void;
  onRetry: () => void;
};
```

Use Task 1 `Button`, `Skeleton` and Lucide icons. Match `.stitch/designs/10-home-nav.html`, including editorial title, image hierarchy, recent rows and exactly one primary tangerine action.

- [ ] **Step 5: Build the V3 list and navigation**

Refactor `RecipeList` around typed `RecipeSummary[]`. Use shadcn `Input`, `Button`, `Drawer`, `Checkbox`, `AlertDialog` and `DropdownMenu`. Preserve URL filters and sessionStorage scroll restoration. `RecipeCard` becomes a typed round-image row and exposes the accessible navigation action:

```tsx
<Button variant="ghost" aria-label={`查看菜谱 ${recipe.name}`} />
```

Do not render a favorite control before Task 4 can provide a real write path. Update BottomNav with Framer Motion shared-layout selected state and hide it for `/recipes/:id` and `/recipes/:id/cook`.

- [ ] **Step 6: Localize assets and implement responsive styles**

Run:

```bash
mkdir -p public/stitch-v3
cp .stitch/assets/stitch-image-*.jpg public/stitch-v3/
```

Use only the images required by home/list fallback presentation. Real saved recipes continue using their stored cover URL. Add V3 named classes to `globals.css`, and delete superseded home/list V2 rules only after the new tests pass.

- [ ] **Step 7: Run Task 2 checks**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/home-v3.test.tsx tests/unit/recipe-list-v3.test.tsx tests/unit/recipe-card.test.tsx tests/unit/recipe-api-shapes.test.ts
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
rg -n "\bany\b|#[0-9a-fA-F]{6}|https://lh3\.googleusercontent\.com|<button|<input" src/components/home src/components/recipe-list.tsx src/components/recipe-card.tsx src/components/bottom-nav.tsx src/lib/domain/recipe-api.ts src/lib/http/api-client.ts
git diff --check
```

Expected: tests and build pass; no new `any`, remote Stitch URL, raw common control or component-local hex color remains in touched files.

- [ ] **Step 8: Review, repair, visually inspect, and commit Task 2**

At 375, 390 and 430 widths inspect home and list against screens 10 and 09. Return review findings to the same implementer until both reviewers pass, then commit:

```bash
git add public/stitch-v3 src/lib/domain/recipe-api.ts src/lib/http/api-error.ts src/lib/http/api-response.ts src/lib/http/api-client.ts src/app/api/recipes/route.ts src/components/home src/components/import-flow.tsx src/components/recipe-list.tsx src/components/recipe-card.tsx src/components/bottom-nav.tsx src/app/globals.css tests/unit/home-v3.test.tsx tests/unit/recipe-list-v3.test.tsx tests/unit/recipe-card.test.tsx tests/unit/recipe-api-shapes.test.ts progress.md docs/qa/最终验收报告.md
git commit -m "feat: rebuild home and recipe list for Stitch V3"
```

---

### Task 3: 导入抽屉、解析、图片审核与确认编辑

**Files:**

- Create: `src/components/import/import-flow-machine.ts`
- Create: `src/components/import/import-sheet.tsx`
- Create: `src/components/import/parsing-progress.tsx`
- Create: `src/components/import/image-review-screen.tsx`
- Create: `tests/unit/import-flow-v3.test.tsx`
- Modify: `src/components/import-flow.tsx`
- Modify: `src/components/recipe-confirm-form.tsx`
- Modify: `src/components/image-carousel.tsx`
- Modify: `src/lib/http/api-client.ts`
- Modify: `src/app/api/import/parse/route.ts`
- Modify: `src/app/api/images/filter/route.ts`
- Modify: `src/app/globals.css`
- Remove after equivalent V3 coverage exists: `tests/unit/import-flow-v2.test.tsx`

**Interfaces:**

- Produces: `ImportFlowState`, `ImportFlowEvent`, `initialImportFlowState`, `importFlowReducer`.
- Produces: presentational components whose props contain state and callbacks, not fetch or router access.
- Consumes: Task 1 shadcn primitives and Task 2 typed API/error helper.

- [ ] **Step 1: Write reducer and screen tests first**

Use this explicit state model in tests:

```ts
export type ImportStage = "home" | "parsing" | "imageReview" | "recipeConfirm" | "saving";
export type ImportFlowState = {
  stage: ImportStage;
  rawInput: string;
  parsingStep: 0 | 1 | 2 | 3;
  draft: RecipeDraft | null;
  reviewUrls: string[];
  selectedUrls: string[];
  coverUrl: string | null;
  error: string | null;
  dirty: boolean;
};
```

Cover these transitions: open/close retains input; parse start; late response ignored by AbortController; parse failure returns to Drawer; filter failure enters review with all images; selection and cover stay consistent; no-image confirm; confirmation validation; save failure retains edits; save success clears draft.

- [ ] **Step 2: Verify RED**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v3.test.tsx
```

Expected: FAIL because `import-flow-machine.ts` and V3 stage components do not exist.

- [ ] **Step 3: Implement the pure reducer**

Implement events with explicit payloads:

```ts
export type ImportFlowEvent =
  | { type: "INPUT_CHANGED"; rawInput: string }
  | { type: "PARSE_STARTED" }
  | { type: "PARSE_STEP_CHANGED"; step: 0 | 1 | 2 | 3 }
  | { type: "PARSE_SUCCEEDED"; draft: RecipeDraft; imageUrls: string[]; selectedUrls: string[] }
  | { type: "PARSE_FAILED"; message: string }
  | { type: "PARSE_CANCELLED" }
  | { type: "IMAGE_TOGGLED"; url: string }
  | { type: "COVER_SELECTED"; url: string | null }
  | { type: "CONFIRM_OPENED"; withoutImages?: boolean }
  | { type: "DRAFT_CHANGED"; draft: RecipeDraft }
  | { type: "SAVE_STARTED" }
  | { type: "SAVE_FAILED"; message: string }
  | { type: "DRAFT_RESTORED"; state: ImportFlowState }
  | { type: "RESET" };
```

The reducer must remove a cover when that image is deselected and derive selections from arrays without duplicated URLs.

- [ ] **Step 4: Split the four UI stages**

Implement:

- `ImportSheet` with shadcn `Drawer`, `Textarea`, `Label` and `Button`.
- `ParsingProgress` with four semantic list items, cancel `AlertDialog`, live status and reduced-motion spinner fallback.
- `ImageReviewScreen` with selected count, cover action, no-image path and fixed safe-area footer.
- `RecipeConfirmForm` with shadcn fields and typed add/remove/update callbacks.

`ImportFlow` owns `AbortController`, API calls, router navigation and sessionStorage. On every new parse or unmount call `controller.abort()`; do not use request counter state as the only cancellation mechanism. Update import and image-filter routes to use Task 2 `apiError` and validate imported image URLs as `http:` or `https:` before returning them to production UI.

- [ ] **Step 5: Match Stitch screens 04, 05, 02 and 01**

Use the exact semantic hierarchy and assets from:

- `.stitch/designs/04-import-sheet.html`
- `.stitch/designs/05-parsing-progress.html`
- `.stitch/designs/02-image-review.html`
- `.stitch/designs/01-recipe-confirm.html`

Implement with named V3 CSS classes. Preserve keyboard input, error text, disabled state, fixed footer clearance and unsaved-draft warning. Remove old import CSS only after all V3 import tests pass.

- [ ] **Step 6: Run Task 3 checks**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/import-flow-v3.test.tsx tests/unit/recipe-schema.test.ts tests/unit/import-service.test.ts
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
rg -n "window\.confirm|\bany\b|#[0-9a-fA-F]{6}|<button|<input|<textarea" src/components/import src/components/import-flow.tsx src/components/recipe-confirm-form.tsx src/components/image-carousel.tsx
git diff --check
```

Expected: no `window.confirm`, new `any`, raw common form control or local hex value remains in touched implementation files.

- [ ] **Step 7: Review, repair, visually inspect, and commit Task 3**

Inspect all four import screens at 375, 390 and 430. Test keyboard opening on the Drawer and long ingredient amounts. After both reviews pass:

```bash
git add src/components/import src/components/import-flow.tsx src/components/recipe-confirm-form.tsx src/components/image-carousel.tsx src/lib/http/api-client.ts src/app/api/import/parse/route.ts src/app/api/images/filter/route.ts src/app/globals.css tests/unit/import-flow-v3.test.tsx progress.md docs/qa/最终验收报告.md
git commit -m "feat: rebuild the Stitch V3 import flow"
```

---

### Task 4: 菜谱详情、收藏持久化与复盘抽屉

**Files:**

- Create: `src/app/api/recipes/[id]/favorite/route.ts`
- Create: `src/components/recipe/favorite-button.tsx`
- Create: `tests/unit/recipe-detail-v3.test.tsx`
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/recipe-repository.ts`
- Modify: `src/lib/domain/recipe-api.ts`
- Modify: `src/lib/http/api-client.ts`
- Modify: `src/app/api/recipes/[id]/route.ts`
- Modify: `src/app/api/recipes/[id]/cook/route.ts`
- Modify: `src/components/recipe-detail.tsx`
- Modify: `src/components/recipe-list.tsx`
- Modify: `src/components/recipe-card.tsx`
- Modify: `src/components/cooking-log-sheet.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/recipe-repository.test.ts`
- Modify: `tests/unit/recipe-api-shapes.test.ts`
- Remove after equivalent V3 coverage exists: `tests/unit/recipe-detail-v2.test.tsx`

**Interfaces:**

- Produces: `setFavorite(id: number, isFavorite: boolean): boolean` on the repository.
- Produces: `setRecipeFavoriteApi(id: number, isFavorite: boolean): Promise<{ isFavorite: boolean }>`.
- Produces: `FavoriteButtonProps = { recipeId: number; recipeName: string; isFavorite: boolean; onChanged(isFavorite: boolean): void }`.
- Consumes: Task 2 `RecipeDetail` contract and Task 1 `Tabs`, `Button`, `DropdownMenu`, `AlertDialog`, `Drawer`.

- [ ] **Step 1: Write migration, API and UI tests**

Add repository coverage proving migration is additive and idempotent:

```ts
it("adds and persists favorite state without resetting existing recipes", () => {
  const db = new Database(":memory:");
  migrate(db);
  const repo = createRecipeRepository(db);
  const saved = repo.saveRecipeDraft(makeDraft());
  migrate(db);
  expect(repo.setFavorite(saved.id, true)).toBe(true);
  expect(repo.getRecipeById(saved.id)?.isFavorite).toBe(true);
  expect(repo.listRecipes()[0]?.isFavorite).toBe(true);
});
```

Add component tests for optimistic favorite success, rollback on failure, list/detail favorite consistency, full “食材 / 步骤” Tabs, delete AlertDialog, error retry, cooking guide trigger, and review form input preservation.

- [ ] **Step 2: Verify RED**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-repository.test.ts tests/unit/recipe-api-shapes.test.ts tests/unit/recipe-detail-v3.test.tsx tests/unit/cooking-log-sheet.test.tsx
```

Expected: FAIL because `is_favorite`, favorite API and V3 detail controls do not exist.

- [ ] **Step 3: Implement the additive migration and typed repository**

After the existing `CREATE TABLE` statements, check `PRAGMA table_info(recipes)` and run this only when absent:

```sql
ALTER TABLE recipes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
```

Define typed row shapes instead of `any`, map SQLite `0 | 1` to boolean, include `isFavorite` in list/detail results, and implement:

```ts
setFavorite(id: number, isFavorite: boolean): boolean {
  const result = db.prepare(
    "UPDATE recipes SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(isFavorite ? 1 : 0, id);
  return result.changes === 1;
}
```

- [ ] **Step 4: Add idempotent favorite API and client rollback**

The route body is `z.object({ isFavorite: z.boolean() })`. Return the uniform Task 2 error envelope with `404` when the recipe does not exist and `{ isFavorite }` on success. Validate numeric route IDs and convert the existing detail, delete and cooking-log routes to the same envelope. `FavoriteButton` sets the requested target state, rolls back on API failure and uses `aria-pressed` plus a recipe-specific accessible name. Wire the same component into `RecipeCard` and `RecipeDetail`; successful writes update the owning list/detail state rather than waiting for a reload.

- [ ] **Step 5: Rebuild detail and review screens**

Match `.stitch/designs/06-recipe-detail.html` and `.stitch/designs/08-recipe-review-sheet.html` using:

- complete shadcn `Tabs` for “食材 / 步骤”;
- Lucide back, favorite, edit and more icons;
- `DropdownMenu` for non-destructive more actions;
- `AlertDialog` for delete;
- shared `FavoriteButton`;
- shadcn `Drawer`, `Textarea` and `Button` for review;
- loading, not-found, retry and image failure states;
- a real “开始做菜” trigger whose guide implementation lands in Task 5.

Until Task 5 is implemented, the trigger opens a typed `onStartCooking` boundary in `RecipeDetail`; do not display “功能后续开放”。

- [ ] **Step 6: Run Task 4 checks**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/recipe-repository.test.ts tests/unit/recipe-api-shapes.test.ts tests/unit/recipe-detail-v3.test.tsx tests/unit/cooking-log-sheet.test.tsx
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
rg -n "\bany\b|window\.confirm|编辑功能后续开放|#[0-9a-fA-F]{6}|<button|<textarea" src/lib/db/recipe-repository.ts src/lib/domain/recipe-api.ts src/lib/http/api-client.ts src/components/recipe-detail.tsx src/components/recipe src/components/cooking-log-sheet.tsx
git diff --check
```

Expected: no touched `any`, native confirm, fake control, raw common input or component-local hex remains.

- [ ] **Step 7: Review, repair, visually inspect, and commit Task 4**

At three widths inspect detail and review Drawer; refresh after favorite; verify list/detail consistency and delete cascade. After reviews pass:

```bash
git add src/lib/db/schema.ts src/lib/db/recipe-repository.ts src/lib/domain/recipe-api.ts src/lib/http/api-client.ts 'src/app/api/recipes/[id]/favorite/route.ts' 'src/app/api/recipes/[id]/route.ts' 'src/app/api/recipes/[id]/cook/route.ts' src/components/recipe src/components/recipe-detail.tsx src/components/recipe-list.tsx src/components/recipe-card.tsx src/components/cooking-log-sheet.tsx src/app/globals.css tests/unit/recipe-repository.test.ts tests/unit/recipe-api-shapes.test.ts tests/unit/recipe-detail-v3.test.tsx tests/unit/cooking-log-sheet.test.tsx progress.md docs/qa/最终验收报告.md
git commit -m "feat: add Stitch V3 detail and favorites"
```

---

### Task 5: 做菜指引、会话、计时、步骤进度与语音

**Files:**

- Create: `src/lib/domain/cooking-session.ts`
- Create: `src/hooks/use-cooking-session.ts`
- Create: `src/hooks/use-cooking-timer.ts`
- Create: `src/hooks/use-speech-narration.ts`
- Create: `src/components/cooking/cooking-guide-drawer.tsx`
- Create: `src/components/cooking/cooking-timer.tsx`
- Create: `src/components/cooking/ingredient-rail.tsx`
- Create: `src/components/cooking/step-timeline.tsx`
- Create: `src/components/cooking/cooking-mode.tsx`
- Create: `src/app/recipes/[id]/cook/page.tsx`
- Create: `tests/unit/cooking-session.test.ts`
- Create: `tests/unit/cooking-timer.test.tsx`
- Create: `tests/unit/speech-narration.test.tsx`
- Create: `tests/unit/cooking-mode.test.tsx`
- Modify: `src/components/recipe-detail.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**

- Produces: `CookingSessionSchema`, `CookingSessionState`, `CookingSessionEvent`, `cookingSessionReducer`.
- Produces: `useCookingSession(recipeId: number, stepOrders: number[]): { state: CookingSessionState; toggleStep(order: number): void; setCurrentStep(order: number): void; setTimer(timer: CookingTimerState): void; setSpeechEnabled(enabled: boolean): void; reset(): void }`.
- Produces: `useCookingTimer(timerState: CookingTimerState, onChange: (timer: CookingTimerState) => void): { remainingMs: number; start(): void; pause(): void; resume(): void; finish(): void; adjust(deltaMs: number): void }`.
- Produces: `useSpeechNarration()` with `supported`, `speaking`, `speak(text)`, `cancel()`.
- Consumes: Task 4 typed RecipeDetail, FavoriteButton, review Drawer and API client.

- [ ] **Step 1: Write pure session tests**

Use this stable state shape:

```ts
export type CookingTimerState = {
  status: "idle" | "running" | "paused" | "finished";
  durationMs: number;
  remainingMs: number;
  deadlineAt: number | null;
};

export type CookingSessionState = {
  version: 1;
  recipeId: number;
  currentStepOrder: number;
  completedStepOrders: number[];
  timer: CookingTimerState;
  speechEnabled: boolean;
};
```

Test toggle/undo, derived completed count, corrupted storage fallback, wrong recipe rejection and state restoration.

- [ ] **Step 2: Write timer and speech hook tests**

Use `vi.useFakeTimers()` and `vi.setSystemTime()` to verify:

- running countdown derives from `deadlineAt - Date.now()`;
- pause freezes remaining time;
- resume creates a new deadline;
- `visibilitychange` recalibrates after a simulated background gap;
- finish clamps to zero;
- all timers and listeners are removed on unmount.

Mock `speechSynthesis` and `SpeechSynthesisUtterance` to verify user-triggered speak, replacement cancellation, step-change cancellation, unmount cancellation and unsupported-browser fallback.

- [ ] **Step 3: Verify RED**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/cooking-session.test.ts tests/unit/cooking-timer.test.tsx tests/unit/speech-narration.test.tsx tests/unit/cooking-mode.test.tsx
```

Expected: FAIL because cooking domain, hooks, route and components do not exist.

- [ ] **Step 4: Implement session persistence and timer**

Use storage key `cooking-session:<recipeId>`. Validate stored JSON with `CookingSessionSchema`; remove invalid payloads and create a clean state. Persist after reducer changes. `useCookingTimer` may use a short display interval, but all displayed time must be recalculated from the absolute deadline; never decrement persistent state once per second as the source of truth.

- [ ] **Step 5: Implement Web Speech isolation**

The hook contract is:

```ts
export type SpeechNarration = {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  cancel: () => void;
};
```

Create utterances only inside `speak`, set `lang = "zh-CN"`, cancel before replacement, update speaking state from `onstart`, `onend` and `onerror`, and cancel on unmount. Do not auto-play on route entry.

- [ ] **Step 6: Build cooking guide and cooking mode**

Match `.stitch/designs/07-cooking-guide.html` and `.stitch/designs/03-cooking-mode.html`:

- `CookingGuideDrawer` shows prep summary and routes to `/recipes/<id>/cook` after explicit confirmation.
- `IngredientRail` is horizontally scrollable and does not trap vertical page gestures.
- `CookingTimer` uses shadcn Buttons for adjust/start/pause/resume/end.
- `StepTimeline` uses Checkbox or Button state with undo, current step, completed count and per-step speech control.
- `CookingMode` loads typed recipe detail, restores session, synchronizes favorite, and opens the shared review Drawer after explicit finish.
- AppShell hides BottomNav on cooking route and provides safe-area bottom clearance.

All Framer Motion gestures use Task 1 spring and respect reduced motion.

- [ ] **Step 7: Run Task 5 checks**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test -- tests/unit/cooking-session.test.ts tests/unit/cooking-timer.test.tsx tests/unit/speech-narration.test.tsx tests/unit/cooking-mode.test.tsx tests/unit/recipe-detail-v3.test.tsx
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
rg -n "setInterval|speechSynthesis|sessionStorage|\bany\b|#[0-9a-fA-F]{6}|<button" src/lib/domain/cooking-session.ts src/hooks src/components/cooking
git diff --check
```

Expected: interval, speech and storage references exist only in the focused hooks; no `any`, raw Button or local hex value exists in cooking business components.

- [ ] **Step 8: Review, repair, visually inspect, and commit Task 5**

Manually verify background/resume, refresh recovery, unsupported speech, reduced motion, session reset and finish-to-review at all widths. After both reviews pass:

```bash
git add src/lib/domain/cooking-session.ts src/hooks src/components/cooking 'src/app/recipes/[id]/cook/page.tsx' src/components/recipe-detail.tsx src/components/app-shell.tsx src/app/globals.css tests/unit/cooking-session.test.ts tests/unit/cooking-timer.test.tsx tests/unit/speech-narration.test.tsx tests/unit/cooking-mode.test.tsx progress.md docs/qa/最终验收报告.md
git commit -m "feat: add the Stitch V3 cooking experience"
```

---

### Task 6: 完整 E2E、三尺寸视觉验收和 Claude Code 交接

**Files:**

- Modify: `playwright.config.js`
- Modify: `tests/e2e/mobile-flow.spec.js`
- Modify: `docs/qa/最终验收报告.md`
- Modify: `progress.md`
- Generate only: `output/playwright-stitch-v3/375/*.png`
- Generate only: `output/playwright-stitch-v3/390/*.png`
- Generate only: `output/playwright-stitch-v3/430/*.png`

**Interfaces:**

- Consumes: all five implementation Tasks.
- Produces: 30 named screenshots, reproducible commands, failure/rework evidence and a final Claude Code verification handoff.

- [ ] **Step 1: Update the E2E screenshot contract**

Use exactly these names at each width:

```js
const SCREENSHOT_NAMES = [
  "01-home-nav.png",
  "02-recipe-list.png",
  "03-import-sheet.png",
  "04-parsing-progress.png",
  "05-image-review.png",
  "06-recipe-confirm.png",
  "07-recipe-detail.png",
  "08-cooking-guide.png",
  "09-cooking-mode.png",
  "10-recipe-review-sheet.png"
];
```

Change output root from `output/playwright-v2` to `output/playwright-stitch-v3`. Keep one worker and the independent temporary SQLite database.

- [ ] **Step 2: Extend real-flow assertions**

The serial E2E must:

1. import and save one deterministic recipe;
2. assert 10 screens and take each screenshot;
3. favorite from detail, reload, and assert list/detail/cooking consistency;
4. open cooking guide and cooking route;
5. set/start/pause/resume the timer without a real long wait;
6. complete and undo a step;
7. exercise supported or explicitly stubbed speech start/stop;
8. finish, submit review, and observe cooked count/rating;
9. retain existing search, filter, delete, scroll restoration, parse failure and image-filter fallback cases;
10. assert no horizontal overflow and no fixed bar obscures final content.

- [ ] **Step 3: Run formatting, lint, unit tests and build**

Run:

```bash
git diff --check
PATH=/Users/mie/.hermes/node/bin:$PATH npm run lint
PATH=/Users/mie/.hermes/node/bin:$PATH npm run test
PATH=/Users/mie/.hermes/node/bin:$PATH npm run build
rg -n "dangerouslySetInnerHTML|https://lh3\\.googleusercontent\\.com|material-symbols|<button|<input|<textarea" src --glob '!src/components/ui/**'
```

Expected: lint, tests and build exit 0. The audit command may only report an approved `shadcn-exception:` site; otherwise remove or replace every match before continuing. Record exact file/test counts and build route summary in the report.

- [ ] **Step 4: Run the complete three-size E2E**

Run:

```bash
PATH=/Users/mie/.hermes/node/bin:$PATH AI_PROVIDER=mock DATABASE_PATH=/tmp/laogong-caipu-stitch-v3-e2e.sqlite npm run test:e2e
find output/playwright-stitch-v3 -type f -name '*.png' | sort
```

Expected: all Playwright projects pass and exactly 30 PNG files exist, 10 under each width.

- [ ] **Step 5: Perform manual visual, motion and accessibility acceptance**

Compare every 390px screenshot with its Stitch screenshot. Inspect 375 and 430 for reflow, safe areas, keyboard, long text, fixed controls and overflow. Run a normal-motion browser pass for spring/drag behavior and a reduced-motion pass for fallback. Keyboard-test Drawer, Tabs, Dialog, favorite, timer, steps and review. Any failure returns to the responsible Task, receives a regression test, and reruns from the earliest affected gate.

- [ ] **Step 6: Complete the final report**

Replace every `待执行` in `docs/qa/最终验收报告.md` with actual evidence or an explicit failed state. Fill commit range, environment, command output summary, 30-image matrix, interaction matrix, Apple motion, reduced motion/transparency, shadcn audit, failure-return history, known differences and exact Claude Code commands. The final conclusion may be “通过” only when every required gate has evidence and passes.

- [ ] **Step 7: Independent final review and commit**

Dispatch a read-only final specification reviewer and code-quality reviewer over the complete Stitch V3 commit range. Main agent independently reruns Steps 3 and 4 after all fixes, then commit:

```bash
git add playwright.config.js tests/e2e/mobile-flow.spec.js docs/qa/最终验收报告.md progress.md
git commit -m "test: verify Stitch V3 mobile experience"
```

Do not commit `output/playwright-stitch-v3/`; the report contains its reproducible index and expected filenames.
