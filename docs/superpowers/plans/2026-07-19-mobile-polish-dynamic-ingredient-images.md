# Mobile Polish and Dynamic Ingredient Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正六项真实手机视觉/交互问题，统一中文宋体排版，并在做菜模式按可见食材通过 Micu 动态生成、缓存和复用食材图片。

**Architecture:** 新增仅服务端可用的 Micu 图片 provider 与文件缓存服务，API 根据已保存菜谱的食材索引生成固定 prompt，客户端只请求受控食材引用。做菜步骤继续使用现有 session reducer，但把完成动作收敛到整行点击并由完成集合推导进度；视觉修订通过现有业务组件和一套明确的排版 token 完成。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、Zod、SQLite repository、shadcn/ui、Framer Motion、Vitest、Testing Library、Playwright、Micu `gpt-image-2`、Fontsource `Noto Serif SC Variable`。

## Global Constraints

- 动态食材图采用方案 B：做菜模式先显示占位，食材卡片进入可视区域时生成，结果按规范化名称和 prompt 版本缓存复用。
- Micu endpoint 固定为 `https://www.micuapi.ai/v1/images/generations`，model 为 `gpt-image-2`，size 为 `1024x1024`，quality 初始为 `low`。
- `MICU_API_KEY` 只允许从服务端进程环境变量读取；不得写入 `.env`、源码、数据库、日志、测试快照、客户端 bundle 或 API 响应。
- 客户端不能提交自由文本图片 prompt；只能提交真实菜谱的 `recipeId + itemKind + itemIndex`。
- 图片缓存目录固定为 `data/generated/ingredients/v1/`，文件键为 `sha256("v1|" + normalizedIngredientName)`。
- 通用交互继续使用 shadcn/ui；不重新手写 Button、Drawer、Dialog、Input、Textarea 等原语。
- 中文主字体使用自托管 `Noto Serif SC Variable`；首页和菜谱列表主标题 32px，其他独立页面标题 24px，紧凑导航标题 18px，区块标题 20px，正文 16px，标签 13px。
- 375px、390px、430px 下不得产生水平溢出；375px 做菜底栏必须保持单行，主要触控目标至少 44px。
- 步骤不显示 Checkbox；点击整行完成或撤销，完成正文显示删除线，右上角进度由完成集合推导为 `x / n`。
- 动效遵循 Apple Design：按下即时反馈、默认无弹跳、生成图短交叉淡入、Reduced Motion 下取消缩放和位移。
- 验收采用精简策略：定向单元测试、一次 390px 主流程、一次 375px 底栏检查、lint 和生产构建；不重跑三尺寸完整截图矩阵。
- 保留用户现有未跟踪的 `DESIGN.md`、`docs/ui-concepts/09-12` 和全部 `output/` 证据，不得删除、覆盖或纳入实现提交。

---

## File Structure

### New files

- `src/lib/images/ingredient-image-service.ts`：食材名规范化、稳定 key、固定 prompt、Micu provider、PNG 校验、缓存和并发去重。
- `src/app/api/recipes/[id]/ingredient-images/route.ts`：验证菜谱食材引用并触发缓存/生成。
- `src/app/api/ingredient-images/[key]/route.ts`：只读返回缓存 PNG。
- `tests/unit/ingredient-image-service.test.ts`：provider 返回归一化、缓存命中、原子写入和并发去重。
- `tests/unit/ingredient-image-route.test.ts`：不存在菜谱/索引、合法食材和缓存读取边界。

### Modified files

- `src/lib/http/api-client.ts`：增加受类型约束的食材图请求。
- `src/components/cooking/ingredient-rail.tsx`：可见性触发、占位、动态图片和失败回退。
- `src/lib/domain/cooking-session.ts`、`src/hooks/use-cooking-session.ts`：完成步骤时推进当前步骤，撤销时恢复当前项。
- `src/components/cooking/step-timeline.tsx`、`src/components/cooking/cooking-mode.tsx`：整行完成交互和无 Checkbox 时间线。
- `src/components/cooking-log-sheet.tsx`：仅保留内容结构，视觉分组交给统一 CSS。
- `src/components/import/parsing-progress.tsx`、`src/components/image-carousel.tsx`、`src/components/recipe-confirm-form.tsx`：稳定轴线节点、封面标识和时间组结构。
- `src/app/layout.tsx`、`src/app/globals.css`：Fontsource 字体、字号 token、六项布局和 Reduced Motion。
- `package.json`、`package-lock.json`：固定 `@fontsource-variable/noto-serif-sc@5.2.10`。
- `tests/unit/cooking-mode.test.tsx`、`tests/unit/cooking-session.test.ts`、`tests/unit/import-flow-v3.test.tsx`：新行为回归。
- `tests/e2e/mobile-flow.spec.js`：动态图 stub、步骤整行、字号/对齐/底栏几何的精简浏览器验收。
- `docs/qa/最终验收报告.md`：增加 2026-07-19 手机实测修订附录和可复制复验命令。

---

### Task 1: Cached Micu Ingredient Image Boundary

**Files:**

- Create: `src/lib/images/ingredient-image-service.ts`
- Create: `src/app/api/recipes/[id]/ingredient-images/route.ts`
- Create: `src/app/api/ingredient-images/[key]/route.ts`
- Create: `tests/unit/ingredient-image-service.test.ts`
- Create: `tests/unit/ingredient-image-route.test.ts`

**Interfaces:**

- Consumes: `createRecipeRepository().getRecipeById(id)` and `apiError(code, message, status)`.
- Produces:

```ts
export type IngredientImageKind = "ingredient" | "seasoning";
export type IngredientImageResult = { key: string; imageUrl: string };
export type IngredientImageService = {
  getOrCreate(name: string): Promise<IngredientImageResult>;
  read(key: string): Promise<Buffer | null>;
};
export function normalizeIngredientName(name: string): string;
export function ingredientImageKey(name: string): string;
export function buildIngredientImagePrompt(name: string): string;
export function createIngredientImageService(deps?: {
  cacheRoot?: string;
  generate?: (name: string) => Promise<Buffer>;
}): IngredientImageService;
```

- POST `/api/recipes/:id/ingredient-images` body: `{ kind: "ingredient" | "seasoning", index: number }`.
- POST success: `{ key: string, imageUrl: "/api/ingredient-images/<64-lowercase-hex>" }`.
- GET `/api/ingredient-images/:key` returns `image/png`, immutable cache headers and an ETag equal to the key.

- [ ] **Step 1: Write service tests before implementation**

Create `tests/unit/ingredient-image-service.test.ts` with a real temporary directory and a valid 1×1 PNG fixture:

```ts
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

it("normalizes names and builds a stable versioned cache key", () => {
  expect(normalizeIngredientName("  蒜   瓣  ")).toBe("蒜 瓣");
  expect(ingredientImageKey("蒜 瓣")).toMatch(/^[a-f0-9]{64}$/);
  expect(ingredientImageKey("蒜  瓣")).toBe(ingredientImageKey("蒜 瓣"));
});

it("shares one generation for simultaneous requests and then reads the cache", async () => {
  const generate = vi.fn().mockResolvedValue(PNG);
  const service = createIngredientImageService({ cacheRoot, generate });
  const [first, second] = await Promise.all([service.getOrCreate("牛肉"), service.getOrCreate("牛肉")]);
  expect(first).toEqual(second);
  expect(generate).toHaveBeenCalledTimes(1);
  await expect(service.read(first.key)).resolves.toEqual(PNG);
  await service.getOrCreate("牛肉");
  expect(generate).toHaveBeenCalledTimes(1);
});

it("rejects a non-PNG provider payload without creating a cache hit", async () => {
  const service = createIngredientImageService({ cacheRoot, generate: vi.fn().mockResolvedValue(Buffer.from("html")) });
  await expect(service.getOrCreate("牛肉")).rejects.toThrow("PNG");
});
```

Also test the real Micu response normalizer with one `b64_json` payload and one `url` payload whose download response is the PNG fixture. Assert that authorization is supplied from a function argument/environment boundary without logging or returning it.

- [ ] **Step 2: Run the service test and verify RED**

Run:

```bash
npm run test -- tests/unit/ingredient-image-service.test.ts
```

Expected: FAIL because `@/lib/images/ingredient-image-service` does not exist.

- [ ] **Step 3: Implement the service with fixed prompt and atomic cache**

Implement these exact semantics in `ingredient-image-service.ts`:

```ts
const VERSION = "v1";
const MICU_URL = "https://www.micuapi.ai/v1/images/generations";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function normalizeIngredientName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function ingredientImageKey(name: string) {
  return createHash("sha256").update(`${VERSION}|${normalizeIngredientName(name)}`).digest("hex");
}

export function buildIngredientImagePrompt(name: string) {
  return `中国家常菜食材摄影，单一食材“${normalizeIngredientName(name)}”，俯拍居中，真实自然纹理，暖米白宣纸色背景，柔和自然光，适合圆形裁切，无文字、无包装、无餐具、无水印。`;
}
```

`generateMicuIngredientPng` must:

1. Read `MICU_API_KEY` at call time and throw `Micu 图片服务未配置` when absent.
2. POST `{ model: "gpt-image-2", prompt, size: "1024x1024", quality: "low", n: 1 }` with Bearer authorization, JSON content type and a stable non-empty User-Agent.
3. Use an abort timeout of 90 seconds.
4. Decode either `data[0].b64_json` or download `data[0].url`.
5. Reject payloads larger than 12 MiB or without the PNG signature.

`createIngredientImageService` must use `data/generated/ingredients/v1` by default, keep an instance-local `Map<string, Promise<IngredientImageResult>>`, write `<key>.<randomUUID>.tmp`, then `rename` to `<key>.png`, and remove the in-flight entry in `finally`.

- [ ] **Step 4: Write route tests before route implementation**

Use exported handler factories so tests inject repository and service dependencies without a real Micu call:

```ts
const recipe = {
  ingredients: [{ name: "牛肉", amount: "200克", type: "ingredient" }],
  seasonings: [{ name: "蒜", amount: "3瓣", type: "seasoning" }]
};

it("rejects an item index that is not present in the saved recipe", async () => {
  const POST = createIngredientImagePostHandler({
    getRecipeById: () => recipe,
    images: { getOrCreate: vi.fn(), read: vi.fn() }
  });
  const response = await POST(jsonRequest({ kind: "ingredient", index: 4 }), { params: { id: "7" } });
  expect(response.status).toBe(404);
});

it("generates only the server-resolved item name", async () => {
  const getOrCreate = vi.fn().mockResolvedValue({ key: "a".repeat(64), imageUrl: `/api/ingredient-images/${"a".repeat(64)}` });
  const POST = createIngredientImagePostHandler({ getRecipeById: () => recipe, images: { getOrCreate, read: vi.fn() } });
  const response = await POST(jsonRequest({ kind: "seasoning", index: 0 }), { params: { id: "7" } });
  expect(getOrCreate).toHaveBeenCalledWith("蒜");
  expect(response.status).toBe(200);
});
```

Add GET assertions for a malformed key (400), cache miss (404), and PNG success with `content-type: image/png`, immutable cache-control and ETag.

- [ ] **Step 5: Run route tests and verify RED**

Run:

```bash
npm run test -- tests/unit/ingredient-image-route.test.ts
```

Expected: FAIL because both route modules are absent.

- [ ] **Step 6: Implement both API routes**

The POST route must use:

```ts
const RequestSchema = z.object({
  kind: z.enum(["ingredient", "seasoning"]),
  index: z.number().int().nonnegative()
});
```

Parse the numeric recipe id, return 404 for a missing recipe or item, call `images.getOrCreate(item.name)`, and map missing configuration to 503 and upstream generation failure to 502. Do not include upstream response bodies or credentials in the error payload.

The GET route must accept only `/^[a-f0-9]{64}$/`, call `images.read(key)`, and return the Buffer with:

```ts
{
  headers: {
    "content-type": "image/png",
    "cache-control": "public, max-age=31536000, immutable",
    etag: `"${key}"`
  }
}
```

- [ ] **Step 7: Run Task 1 tests and commit**

Run:

```bash
npm run test -- tests/unit/ingredient-image-service.test.ts tests/unit/ingredient-image-route.test.ts
```

Expected: both files PASS; no real Micu request occurs.

Commit only Task 1 files:

```bash
git add src/lib/images/ingredient-image-service.ts src/app/api/recipes/'[id]'/ingredient-images/route.ts src/app/api/ingredient-images/'[key]'/route.ts tests/unit/ingredient-image-service.test.ts tests/unit/ingredient-image-route.test.ts
git commit -m "feat: add cached Micu ingredient images"
```

---

### Task 2: Lazy Ingredient Image UI

**Files:**

- Modify: `src/lib/http/api-client.ts`
- Modify: `src/components/cooking/ingredient-rail.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/cooking-mode.test.tsx`

**Interfaces:**

- Consumes Task 1 POST response `{ key, imageUrl }`.
- Produces:

```ts
export function requestIngredientImageApi(
  recipeId: number,
  kind: "ingredient" | "seasoning",
  index: number,
  signal?: AbortSignal
): Promise<{ key: string; imageUrl: string }>;
```

- `IngredientRail` remains `({ recipe }: { recipe: RecipeDetail })` and does not expose the API key or a free-form prompt prop.

- [ ] **Step 1: Add a failing dynamic-image component test**

Extend the hoisted API mocks in `tests/unit/cooking-mode.test.tsx` with `requestIngredientImage`, export it from the `@/lib/http/api-client` mock as `requestIngredientImageApi`, and add:

```tsx
it("loads a server-controlled image for a visible ingredient and keeps the text fallback", async () => {
  state.requestIngredientImage.mockResolvedValue({ key: "a".repeat(64), imageUrl: "/api/ingredient-images/cached" });
  render(<CookingMode recipeId={7} />);
  expect(await screen.findByText("里脊肉")).toBeInTheDocument();
  await waitFor(() => expect(state.requestIngredientImage).toHaveBeenCalledWith(7, "ingredient", 0, expect.any(AbortSignal)));
  expect(await screen.findByTestId("ingredient-image-ingredient-0")).toHaveAttribute("src", "/api/ingredient-images/cached");
  expect(screen.getByText("里")).toBeInTheDocument();
});
```

Add a rejection case and assert that the ingredient name, amount and first-character fallback remain visible without an error dialog.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm run test -- tests/unit/cooking-mode.test.tsx
```

Expected: FAIL because `requestIngredientImageApi` and the ingredient image test id do not exist.

- [ ] **Step 3: Add the typed API client method**

Append to `api-client.ts`:

```ts
const IngredientImageResponseSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  imageUrl: z.string().min(1)
});

export function requestIngredientImageApi(recipeId: number, kind: "ingredient" | "seasoning", index: number, signal?: AbortSignal) {
  return requestJson(
    `/api/recipes/${recipeId}/ingredient-images`,
    IngredientImageResponseSchema,
    { method: "POST", body: JSON.stringify({ kind, index }) },
    signal
  );
}
```

- [ ] **Step 4: Implement visible-card generation and graceful fallback**

In `IngredientRail` preserve the existing ready/check behavior, but represent items as `{ ingredient, kind, index }` so the server receives the correct per-list index. Add a small `IngredientVisual` child that:

1. Observes its card with `IntersectionObserver` using the horizontal rail as `root` and `rootMargin: "0px 96px"`.
2. Falls back to immediate loading when `IntersectionObserver` is unavailable (Vitest/older browsers).
3. Creates one `AbortController` when it becomes visible and calls `requestIngredientImageApi` once.
4. Keeps the first character rendered beneath the image.
5. Renders `<img data-testid={\`ingredient-image-${kind}-${index}\`} alt="" aria-hidden="true">` only after success.
6. Silently preserves the fallback on failure and aborts the client request on unmount.

Use this visual structure:

```tsx
<span className={`cooking-ingredient-avatar ${imageUrl ? "has-image" : ""}`}>
  <span className="cooking-ingredient-fallback" aria-hidden="true">{ingredient.name.slice(0, 1)}</span>
  {imageUrl ? <img data-testid={`ingredient-image-${kind}-${index}`} src={imageUrl} alt="" aria-hidden="true" /> : null}
  {checked ? <span className="cooking-ingredient-ready"><Check aria-hidden="true" /></span> : null}
</span>
```

- [ ] **Step 5: Add ingredient image CSS and Reduced Motion fallback**

Use exact geometry compatible with the current 72px circle:

```css
.cooking-ingredient-avatar { position: relative; overflow: hidden; isolation: isolate; }
.cooking-ingredient-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; animation: ingredient-image-in 180ms ease-out forwards; }
.cooking-ingredient-fallback { position: relative; z-index: 0; }
.cooking-ingredient-ready { position: absolute; z-index: 2; inset: 0; display: grid; place-items: center; background: hsl(var(--primary) / 0.78); color: hsl(var(--primary-foreground)); }
@keyframes ingredient-image-in { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .cooking-ingredient-avatar img { animation: none; opacity: 1; } }
```

- [ ] **Step 6: Run Task 2 test and commit**

Run:

```bash
npm run test -- tests/unit/cooking-mode.test.tsx
```

Expected: all cooking-mode tests PASS and the failure case retains the fallback.

Commit:

```bash
git add src/lib/http/api-client.ts src/components/cooking/ingredient-rail.tsx src/app/globals.css tests/unit/cooking-mode.test.tsx
git commit -m "feat: lazy-load generated ingredient images"
```

---

### Task 3: Direct Step Completion and Compact Cooking Chrome

**Files:**

- Modify: `src/lib/domain/cooking-session.ts`
- Modify: `src/hooks/use-cooking-session.ts`
- Modify: `src/components/cooking/step-timeline.tsx`
- Modify: `src/components/cooking/cooking-mode.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/cooking-session.test.ts`
- Modify: `tests/unit/cooking-mode.test.tsx`
- Modify: `tests/unit/cooking-log-sheet.test.tsx`

**Interfaces:**

- `STEP_TOGGLED` becomes `{ type: "STEP_TOGGLED"; order: number; stepOrders: number[] }`.
- `useCookingSession.toggleStep(order)` remains the component-facing API and injects its closed-over `stepOrders`.
- `StepTimeline` removes `onCurrentStep`; its row calls `onToggleStep(order)`.

- [ ] **Step 1: Update reducer tests for automatic progression**

Replace the first cooking-session test with:

```ts
it("completes a tapped step, advances to the next incomplete step, and restores it on undo", () => {
  const initial = createCookingSession(7, [1, 2, 3]);
  const completed = cookingSessionReducer(initial, { type: "STEP_TOGGLED", order: 1, stepOrders: [1, 2, 3] });
  expect(completed.completedStepOrders).toEqual([1]);
  expect(completed.currentStepOrder).toBe(2);
  const undone = cookingSessionReducer(completed, { type: "STEP_TOGGLED", order: 1, stepOrders: [1, 2, 3] });
  expect(undone.completedStepOrders).toEqual([]);
  expect(undone.currentStepOrder).toBe(1);
});
```

Add a test completing steps out of order and assert the reducer chooses the next later incomplete step, then the first remaining incomplete step, and finally keeps the last completed order when all steps are complete.

- [ ] **Step 2: Update component tests to require an entire-row action**

In `cooking-mode.test.tsx`, replace checkbox queries with buttons named `完成第 1 步：切好里脊肉` and `撤销完成第 1 步：切好里脊肉`. Assert:

```tsx
expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "完成第 1 步：切好里脊肉" }));
expect(screen.getByText("1 / 2")).toBeInTheDocument();
expect(screen.getByText("切好里脊肉").closest("li")).toHaveClass("is-completed");
fireEvent.click(screen.getByRole("button", { name: "撤销完成第 1 步：切好里脊肉" }));
expect(screen.getByText("0 / 2")).toBeInTheDocument();
```

Keep the existing review submission path by completing both row buttons before clicking `完成做菜`.

- [ ] **Step 3: Run both tests and verify RED**

Run:

```bash
npm run test -- tests/unit/cooking-session.test.ts tests/unit/cooking-mode.test.tsx
```

Expected: FAIL because the event lacks `stepOrders`, checkboxes still render, and completed rows have no class.

- [ ] **Step 4: Implement reducer progression and whole-row steps**

For a completion, compute the sorted completed set first, then choose current step with this exact rule:

```ts
const laterIncomplete = event.stepOrders.find((candidate) => candidate > event.order && !completedStepOrders.includes(candidate));
const anyIncomplete = event.stepOrders.find((candidate) => !completedStepOrders.includes(candidate));
const currentStepOrder = laterIncomplete ?? anyIncomplete ?? event.order;
```

For an undo, remove the order and set `currentStepOrder` back to that order.

In `StepTimeline` remove the Checkbox import and render each item as:

```tsx
<li className={`${current ? "is-current" : ""} ${completed ? "is-completed" : ""}`.trim()}>
  <Button
    variant="ghost"
    className="cooking-step-copy"
    aria-current={current ? "step" : undefined}
    aria-pressed={completed}
    aria-label={`${completed ? "撤销完成" : "完成"}第 ${step.order} 步：${step.text}`}
    data-press-feedback="apple"
    onClick={() => onToggleStep(step.order)}
  >
    <span aria-hidden="true">{String(step.order).padStart(2, "0")}</span>
    <p>{step.text}</p>
  </Button>
  {speechEnabled ? <Button variant="ghost" size="icon" aria-label={`播报第 ${step.order} 步`} data-press-feedback="apple" onClick={() => onSpeak(step.text)}><Volume2 aria-hidden="true" /></Button> : null}
</li>
```

In `CookingMode`, cancel current speech before `session.toggleStep(order)` and remove the separate `onCurrentStep` prop.

- [ ] **Step 5: Apply completed-state, footer and review spacing CSS**

Use these contracts:

```css
.cooking-steps li.is-completed .cooking-step-copy p { color: hsl(var(--on-surface-variant)); text-decoration: line-through; text-decoration-color: hsl(var(--primary) / 0.7); text-decoration-thickness: 1.5px; }
.cooking-steps li.is-completed .cooking-step-copy > span { color: hsl(var(--on-surface-variant) / 0.45); }
.cooking-mode-footer { flex-wrap: nowrap; gap: 6px; padding-inline: 16px; }
.cooking-timer { flex: 1 1 auto; gap: 6px; }
.cooking-timer-controls { flex: 0 1 126px; min-width: 0; }
.cooking-timer-controls button, .cooking-timer-actions button { width: 44px; min-width: 44px; height: 44px; min-height: 44px; }
.cooking-timer p { min-width: 42px; }
.cooking-timer-actions { flex: 0 0 auto; gap: 6px; }
.cooking-finish { flex: 0 0 auto; min-height: 44px; padding-inline: 10px; font-size: 13px; }
.cook-review-time-row { border-top: 0; border-radius: 12px; background: hsl(var(--surface-low)); padding: 10px 12px; }
.cook-review-footer { border-top: 0; }
```

Remove the older conflicting `border-top` and `gap: 0.125rem/0.25rem` declarations for these selectors instead of leaving two active contracts. Keep Reduced Transparency behavior.

- [ ] **Step 6: Run Task 3 tests and commit**

Run:

```bash
npm run test -- tests/unit/cooking-session.test.ts tests/unit/cooking-mode.test.tsx tests/unit/cooking-log-sheet.test.tsx
```

Expected: all three files PASS; no Checkbox exists in cooking steps; review form behavior remains unchanged.

Commit:

```bash
git add src/lib/domain/cooking-session.ts src/hooks/use-cooking-session.ts src/components/cooking/step-timeline.tsx src/components/cooking/cooking-mode.tsx src/app/globals.css tests/unit/cooking-session.test.ts tests/unit/cooking-mode.test.tsx tests/unit/cooking-log-sheet.test.tsx
git commit -m "feat: streamline cooking progress interactions"
```

---

### Task 4: Chinese Typography, Transaction-Screen Density, and Focused Acceptance

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/import/parsing-progress.tsx`
- Modify: `src/components/image-carousel.tsx`
- Modify: `src/components/recipe-confirm-form.tsx`
- Modify: `tests/unit/import-flow-v3.test.tsx`
- Modify: `tests/e2e/mobile-flow.spec.js`
- Modify: `docs/qa/最终验收报告.md`

**Interfaces:**

- Produces four `span.import-parsing-step-node` elements with state styling applied to the node, never to the grid track.
- Produces `data-testid="recipe-time-group"` around clock, numeric input and the non-wrapping `分钟` label.
- Imports `@fontsource-variable/noto-serif-sc/wght.css` in the root layout.

- [ ] **Step 1: Add failing structural and computed-style assertions**

Extend `import-flow-v3.test.tsx`:

```tsx
render(<ParsingProgress step={1} source="来源" onCancel={vi.fn()} />);
expect(document.querySelectorAll(".import-parsing-step-node")).toHaveLength(4);

render(<RecipeConfirmForm draft={{ ...draft, cookTimeMinutes: 15 }} onChange={vi.fn()} />);
expect(screen.getByTestId("recipe-time-group")).toHaveTextContent("15分钟");
```

In the main Playwright flow, stub `**/api/recipes/*/ingredient-images` to return deterministic `IMAGE_URLS` and update step queries to the row-button names from Task 3. Add computed assertions at the corresponding screens:

```js
expect(await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Noto Serif SC Variable");
expect(await page.locator(".import-parsing-title").evaluate((element) => getComputedStyle(element).fontSize)).toBe("24px");
expect(await page.locator(".image-review-title").evaluate((element) => getComputedStyle(element).fontSize)).toBe("24px");
expect(await page.locator(".image-review-cover-pill").evaluate((element) => ({ display: getComputedStyle(element).display, align: getComputedStyle(element).alignItems, justify: getComputedStyle(element).justifyContent }))).toEqual({ display: "flex", align: "center", justify: "center" });
expect(await page.getByTestId("recipe-time-group").evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
```

After opening cooking mode, assert the first ingredient image appears, a tapped step gains `is-completed`, its paragraph has `textDecorationLine === "line-through"`, the counter is `1 / 2`, and the footer children share one row. After opening review, assert both `.cook-review-time-row` and `.cook-review-footer` have `borderTopWidth === "0px"`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run unit first:

```bash
npm run test -- tests/unit/import-flow-v3.test.tsx
```

Expected: FAIL because the parsing node and time-group test id do not exist.

Then stop any manually running port-3000 server and run only the 390px main flow:

```bash
npx playwright test tests/e2e/mobile-flow.spec.js --project=mobile-390 --grep "imports, favorites, cooks"
```

Expected: FAIL on the first new typography/alignment assertion.

- [ ] **Step 3: Install and import the self-hosted Chinese font**

Run:

```bash
npm install @fontsource-variable/noto-serif-sc@5.2.10
```

In `src/app/layout.tsx`, import the font before the application stylesheet:

```ts
import "@fontsource-variable/noto-serif-sc/wght.css";
import "./globals.css";
```

Set the body/control family to:

```css
font-family: "Noto Serif SC Variable", "Songti SC", STSong, serif;
```

- [ ] **Step 4: Stabilize parsing, cover and confirmation markup**

Wrap every parsing marker child in `<span className="import-parsing-step-node">` so the outer `.import-parsing-step-marker` never changes dimensions.

Give both the current-cover `<span>` and set-cover shadcn `Button` the same `image-review-cover-pill` class; do not replace the interactive Button with a native element.

Wrap the time controls in:

```tsx
<div data-testid="recipe-time-group" className="recipe-confirm-time-group">
  <Clock3 aria-hidden="true" />
  <Label className="sr-only" htmlFor="recipe-time">烹饪时间</Label>
  <Input
    id="recipe-time"
    aria-label="烹饪时间"
    inputMode="numeric"
    value={draft.cookTimeMinutes?.toString() ?? ""}
    onChange={(event) => update({ ...draft, cookTimeMinutes: event.target.value ? Number(event.target.value) : null })}
  />
  <span>分钟</span>
</div>
```

The existing difficulty DropdownMenu remains a sibling and still uses shadcn `Button`.

- [ ] **Step 5: Consolidate the canonical typography and density CSS**

Define one final token block and remove conflicting later declarations for the same selectors:

```css
:root {
  --font-cn: "Noto Serif SC Variable", "Songti SC", STSong, serif;
  --type-display: 2rem;
  --type-page-title: 1.5rem;
  --type-nav-title: 1.125rem;
  --type-dish-title: 1.5rem;
  --type-section-title: 1.25rem;
  --type-body: 1rem;
  --type-label: 0.875rem;
  --type-chip: 0.8125rem;
}
body, button, input, textarea, select { font-family: var(--font-cn); }
.v3-home h1, .v3-list h1 { font-size: var(--type-display); line-height: 1.15; }
.import-parsing-title, .image-review-title, .recipe-confirm-header h1 { font-size: var(--type-page-title); line-height: 1.3; }
.cooking-mode-header h1 { font-size: var(--type-nav-title); }
.recipe-confirm-name, .recipe-detail-v3-summary h1 { font-size: var(--type-dish-title); line-height: 1.3; }
.recipe-confirm-section-title, .recipe-detail-v3 h2, .cooking-section-heading h2 { font-size: var(--type-section-title); }
.recipe-confirm-tag { min-height: 32px; padding: 4px 10px; font-size: var(--type-chip); }
```

Apply these exact layout corrections:

```css
.image-review-cover-pill { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
.import-parsing-step { grid-template-columns: 36px minmax(0, 1fr); gap: 12px; }
.import-parsing-step-marker { display: grid; width: 36px; place-items: start center; }
.import-parsing-step-node { position: relative; z-index: 1; display: grid; width: 32px; height: 32px; box-sizing: border-box; place-items: center; border-radius: 9999px; background: hsl(var(--canvas)); }
.import-parsing-step:not(:last-child)::after { left: 18px; top: 32px; }
.import-parsing-step strong { font-size: 16px; line-height: 1.35; }
.import-parsing-step small { font-size: 13px; line-height: 1.45; }
.recipe-confirm-summary { grid-template-columns: minmax(0, 1fr) 88px; }
.recipe-confirm-cover { width: 88px; height: 88px; flex-basis: 88px; }
.recipe-confirm-inline-metadata, .recipe-confirm-time-group { min-width: 0; }
.recipe-confirm-time-group { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.recipe-confirm-time-group input { width: 3.5ch; min-width: 3.5ch; text-align: center; font-variant-numeric: tabular-nums; }
.recipe-confirm-time-group > span { flex: 0 0 auto; }
```

The completed/waiting/current node styles must target `.import-parsing-step-node` children and must never set a different width on `.import-parsing-step-marker`.

- [ ] **Step 6: Run unit and focused browser acceptance**

Run:

```bash
npm run test -- tests/unit/import-flow-v3.test.tsx tests/unit/cooking-session.test.ts tests/unit/cooking-mode.test.tsx tests/unit/cooking-log-sheet.test.tsx tests/unit/ingredient-image-service.test.ts tests/unit/ingredient-image-route.test.ts
npx playwright test tests/e2e/mobile-flow.spec.js --project=mobile-390 --grep "imports, favorites, cooks"
npx playwright test tests/e2e/mobile-flow.spec.js --project=mobile-375 --grep "imports, favorites, cooks"
```

Expected: all named unit files PASS; both focused main flows PASS. The 390 screenshot set is the visual review source; the 375 run specifically proves the footer remains one row and no horizontal overflow exists.

- [ ] **Step 7: Run one live Micu smoke test without persisting the key**

The primary agent, not a subagent report, starts the app with `MICU_API_KEY` already present in that process environment. Seed one recipe, POST its first ingredient reference, fetch the returned `imageUrl`, verify PNG signature and then POST the same reference again. The second response must return the same key without creating a second file. Do not print authorization headers, environment values or upstream raw payloads.

- [ ] **Step 8: Run final lint/build and inspect the focused screenshots**

Run:

```bash
npm run lint
npm run build
```

Expected: both exit 0. Inspect the final 390px screenshots for the six reported defects and the dynamically stubbed ingredient imagery; if any acceptance item fails, return Task 4 to implementation before writing the report.

- [ ] **Step 9: Update the final acceptance report**

Append `## 14. 2026-07-19 手机实测修订验收` to `docs/qa/最终验收报告.md`. Record:

- The four task commit hashes from `git log --oneline -8`.
- Exact targeted unit file/test counts.
- 390px and 375px focused Playwright results.
- lint and build exit status.
- Live Micu smoke result: key accepted, first generation returned PNG, repeated request hit the same cache key; never record the credential.
- Manual findings for cover centering, 24px non-hero titles, timeline alignment, `15 分钟` no-wrap, review borders, single-row footer, row deletion line and `1 / 8` progress.
- Claude Code replay commands with `MICU_API_KEY` described as a required local environment variable, never as a literal value.

Mark the addendum PASS only if every item above has evidence. Otherwise list the failed item as NOT PASS and return it to the relevant implementation task.

- [ ] **Step 10: Commit Task 4**

Commit only the font, visual, acceptance and report files:

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css src/components/import/parsing-progress.tsx src/components/image-carousel.tsx src/components/recipe-confirm-form.tsx tests/unit/import-flow-v3.test.tsx tests/e2e/mobile-flow.spec.js docs/qa/最终验收报告.md
git commit -m "fix: polish mobile cooking experience"
```
