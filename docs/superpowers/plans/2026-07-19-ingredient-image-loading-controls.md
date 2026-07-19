# Ingredient Image Loading and Cooking Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让做菜模式在食材图片自动生成和浏览器下载期间显示清晰骨架反馈，将大图缓存压缩为 256×256 WebP，并使“全部勾选”可以再次点击取消全选。

**Architecture:** `IngredientVisual` 保留现有 IntersectionObserver 与 Strict Mode replacement request 语义，用显式请求/图片加载 phase 驱动 shadcn Skeleton、首字 fallback 和淡入。服务端继续接收 Micu PNG，但通过直接依赖的 sharp 转换为版本化 WebP 小图后再原子缓存；客户端 URL 与 API 形状不变。

**Tech Stack:** React 18、TypeScript、shadcn/ui Skeleton/Button、Apple Design motion、Next.js 14 route handlers、Micu `gpt-image-2`、sharp 0.35.3、Vitest、Testing Library、Playwright Chromium 390px。

## Global Constraints

- 必须先读并遵循 `apple-design`、`test-driven-development` 与 `verification-before-completion` skills；不得以自制基础按钮或自制 Skeleton 替代 shadcn/ui。
- 保留已有 Strict Mode 保障：第一次 effect 请求被 cleanup abort 后，replay 必须发起 replacement request；卸载后旧 Promise 不得写 state。
- 食材卡片初始渲染不等待网络，只在进入或即将进入横向轨道可视区时自动请求。
- 骨架覆盖 API 请求和 `<img>` 实际加载两个阶段；图片 `load` 后才结束，`error` 后恢复首字。
- Loading 容器必须提供 `aria-busy` 和屏幕阅读器文本；Reduced Motion 下无旋转、缩放或位移动画。
- “全部勾选”全选后文案变为“取消全选”，再次点击清空；部分选中点击时补齐全选。
- Micu 参数保持 `model=gpt-image-2`、`size=1024x1024`、`quality=low`、`n=1`；不声称压缩能缩短上游 AI 推理时间。
- sharp 固定为 `0.35.3`；Node engine 同家庭门禁计划为 `>=20.9 <21`，符合 sharp 官方 Node-API v9 前提。
- 服务端缓存版本固定升级为 `v2`，输出固定 256×256、WebP quality 60、effort 4，缓存扩展名 `.webp`。
- 客户端不得提交自由 prompt；服务端密钥边界、12 MiB provider 响应上限、原子写入和进程内 in-flight 去重保持不变。
- 每项只跑定向测试；两份实施计划都完成后才运行一次 lint、一次 build、一次完整单元测试和一次 390px 集成流程。
- 保留用户未跟踪的 `DESIGN.md`、`docs/ui-concepts/09-12`、`.playwright-cli/` 与全部现有 `output/`；新截图只写入新目录。

---

## File Structure

### New files

- `src/lib/images/ingredient-image-optimizer.ts`：sharp 256×256 WebP 转换和 WebP 内容校验。
- `tests/unit/ingredient-image-optimizer.test.ts`：真实 metadata/尺寸/格式测试。
- `tests/e2e/family-cooking-flow.spec.js`：单一 390px 家庭解锁与做菜集成流程。
- `playwright.family.config.cjs`：只运行该集成流程和一个 viewport。

### Modified files

- `src/components/cooking/ingredient-rail.tsx`：phase、shadcn Skeleton、图片 load/error、全选切换。
- `src/app/globals.css`：骨架层、加载环、淡入与 Reduced Motion。
- `tests/unit/cooking-mode.test.tsx`：现有未完成 RED 测试修正并覆盖浏览器图片 load。
- `src/lib/images/ingredient-image-service.ts`：v2 `.webp` 缓存、optimizer 注入和校验。
- `src/lib/images/ingredient-image-route-handlers.ts`：缓存响应 MIME 改为 `image/webp`。
- `tests/unit/ingredient-image-service.test.ts`：生成→优化→缓存和损坏 WebP 回归。
- `tests/unit/ingredient-image-route.test.ts`：WebP 响应契约。
- `package.json`、`package-lock.json`：直接依赖 `sharp@0.35.3`，增加单一集成脚本。
- `docs/qa/最终验收报告.md`：最终集成后增加家庭共享与图片加载验收附录。

---

### Task 1: Ingredient Skeleton and Toggle-All Interaction

**Files:**

- Modify: `src/components/cooking/ingredient-rail.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/cooking-mode.test.tsx`

**Interfaces:**

- Consumes existing `requestIngredientImageApi(recipeId, kind, index, signal)` and shadcn `Skeleton`/`Button`.
- Produces no public API changes.
- Internal phase is exactly `"idle" | "requesting" | "loading" | "ready" | "failed"`.

- [ ] **Step 1: Repair and complete the already-written RED tests**

The worktree already contains two uncommitted test cases. Keep them, but replace the ambiguous ingredient query:

```tsx
const ingredient = screen.getByText("里脊肉").closest("button");
expect(ingredient).not.toBeNull();
```

Update the loading test so API completion alone does not end the skeleton:

```tsx
const avatar = screen.getByText("里").closest(".cooking-ingredient-avatar");
expect(avatar).toHaveAttribute("aria-busy", "true");
expect(avatar).toHaveClass("is-loading");
expect(screen.getByText("正在生成里脊肉图片")).toHaveClass("sr-only");

resolveImage?.({ key: "a".repeat(64), imageUrl: "/api/ingredient-images/generated" });
const image = await screen.findByTestId("ingredient-image-ingredient-0");
expect(avatar).toHaveAttribute("aria-busy", "true");
fireEvent.load(image);
expect(avatar).toHaveAttribute("aria-busy", "false");
expect(avatar).not.toHaveClass("is-loading");
```

Add an image error assertion: after `fireEvent.error(image)`, the image is removed, `aria-busy=false`, the avatar has `is-failed`, and the first character remains visible.

Keep the toggle test assertions:

```tsx
expect(screen.getByRole("button", { name: "全部勾选" })).toHaveAttribute("aria-pressed", "false");
fireEvent.click(screen.getByRole("button", { name: "全部勾选" }));
expect(ingredient).toHaveAttribute("aria-pressed", "true");
fireEvent.click(screen.getByRole("button", { name: "取消全选" }));
expect(ingredient).toHaveAttribute("aria-pressed", "false");
```

- [ ] **Step 2: Run the cooking test and verify genuine RED**

Run:

```bash
npm run test -- tests/unit/cooking-mode.test.tsx
```

Expected: exactly the new skeleton and toggle-all behavior fails; existing Strict Mode, observer, steps and guide cases remain green. If a query itself throws for ambiguity, fix the test before implementation and rerun RED.

- [ ] **Step 3: Implement the image phase without regressing Strict Mode**

Replace the two independent URL/loading booleans with:

```tsx
type ImagePhase = "idle" | "requesting" | "loading" | "ready" | "failed";
const [phase, setPhase] = useState<ImagePhase>("idle");
const [imageUrl, setImageUrl] = useState<string | null>(null);
const loading = phase === "requesting" || phase === "loading";
```

Inside the existing effect-local `load`:

```tsx
setPhase("requesting");
controller = new AbortController();
void requestIngredientImageApi(recipeId, kind, index, controller.signal)
  .then(({ imageUrl: nextImageUrl }) => {
    if (cancelled) return;
    setImageUrl(nextImageUrl);
    setPhase("loading");
  })
  .catch(() => {
    if (!cancelled) setPhase("failed");
  });
```

Do not move `requested` back into a ref. Keep it local to each effect setup so Strict Mode replay can replace an aborted request.
At the start of each new effect setup, reset stale props-bound state with `setImageUrl(null)` and `setPhase("idle")` before installing the observer; cleanup still only marks the setup cancelled, disconnects its observer, and aborts its controller.

- [ ] **Step 4: Render the shadcn Skeleton and real image events**

Change the avatar wrapper to a `div` so it can validly contain the existing div-based `Skeleton`:

```tsx
<div
  ref={avatarRef}
  className={`cooking-ingredient-avatar is-${phase} ${imageUrl ? "has-image" : ""}`}
  aria-busy={loading}
>
  {loading ? <Skeleton aria-hidden="true" className="cooking-ingredient-skeleton" /> : null}
  <span className="cooking-ingredient-fallback" aria-hidden="true">{ingredient.name.slice(0, 1)}</span>
  {loading ? <span className="sr-only">正在生成{ingredient.name}图片</span> : null}
  {imageUrl ? <img
    data-testid={`ingredient-image-${kind}-${index}`}
    src={imageUrl}
    alt=""
    aria-hidden="true"
    onLoad={() => setPhase("ready")}
    onError={() => { setImageUrl(null); setPhase("failed"); }}
  /> : null}
  {checked ? <span className="cooking-ingredient-ready"><Check aria-hidden="true" /></span> : null}
</div>
```

Update the ref type to `HTMLDivElement`. The image should only receive full opacity in `.is-ready`; while loading it may exist in the DOM but remains transparent behind the fallback.

- [ ] **Step 5: Implement reversible toggle-all**

Derive rather than store a second global state:

```tsx
const allReady = ingredients.length > 0 && ingredients.every((_, index) => ready.includes(index));

function toggleAll() {
  setReady((current) => {
    const currentlyAllReady = ingredients.length > 0 && ingredients.every((_, index) => current.includes(index));
    return currentlyAllReady ? [] : ingredients.map((_, index) => index);
  });
}
```

The shadcn Button must use `aria-pressed={allReady}`, `onClick={toggleAll}`, `data-press-feedback="apple"`, and label `allReady ? "取消全选" : "全部勾选"`.

- [ ] **Step 6: Add restrained skeleton CSS**

Use these stacking and motion rules, adjusted only for existing tokens:

```css
.cooking-ingredient-skeleton { position: absolute; inset: 0; z-index: 0; border-radius: 9999px; }
.cooking-ingredient-avatar.is-loading::after {
  content: ""; position: absolute; z-index: 2; inset: 4px;
  border: 2px solid hsl(var(--primary) / 0.18);
  border-top-color: hsl(var(--primary)); border-radius: 9999px;
  animation: ingredient-image-loading 900ms linear infinite;
}
.cooking-ingredient-avatar img { z-index: 3; opacity: 0; }
.cooking-ingredient-avatar.is-ready img { animation: ingredient-image-in 180ms ease-out forwards; }
.cooking-ingredient-ready { z-index: 4; }
@keyframes ingredient-image-loading { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) {
  .cooking-ingredient-skeleton, .cooking-ingredient-avatar.is-loading::after { animation: none; }
  .cooking-ingredient-avatar.is-ready img { animation: none; opacity: 1; }
}
```

The first character remains above the Skeleton but below the loaded image. Loading and failure must not change the 72px avatar geometry.

- [ ] **Step 7: Run focused cooking tests and commit**

Run:

```bash
npm run test -- tests/unit/cooking-mode.test.tsx
```

Expected: all cooking-mode cases pass, including Strict Mode replacement, skeleton-through-image-load, failure fallback and reversible toggle-all.

Commit only Task 1 files:

```bash
git add src/components/cooking/ingredient-rail.tsx src/app/globals.css tests/unit/cooking-mode.test.tsx
git commit -m "fix: explain ingredient image loading"
```

---

### Task 2: 256px WebP Optimization and V2 Cache

**Files:**

- Create: `src/lib/images/ingredient-image-optimizer.ts`
- Create: `tests/unit/ingredient-image-optimizer.test.ts`
- Modify: `src/lib/images/ingredient-image-service.ts`
- Modify: `src/lib/images/ingredient-image-route-handlers.ts`
- Modify: `tests/unit/ingredient-image-service.test.ts`
- Modify: `tests/unit/ingredient-image-route.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces:

```ts
export const INGREDIENT_IMAGE_SIZE = 256;
export async function optimizeIngredientImage(png: Buffer): Promise<Buffer>;
export function validateIngredientWebp(image: Buffer): Buffer;
```

- Extends service dependency injection:

```ts
export function createIngredientImageService(deps?: {
  cacheRoot?: string;
  generate?: (name: string) => Promise<Buffer>;
  optimize?: (png: Buffer) => Promise<Buffer>;
}): IngredientImageService;
```

- `IngredientImageService.read` still returns `Buffer | null`, now always a validated WebP buffer.
- Public image URL remains `/api/ingredient-images/<key>`.

- [ ] **Step 1: Install the exact direct dependency**

Run:

```bash
npm install --save-exact sharp@0.35.3
```

Expected: `package.json` contains `"sharp": "0.35.3"` under dependencies and the lockfile contains the platform optional packages. Do not rely on a Next.js transitive sharp installation.

- [ ] **Step 2: Write the optimizer test before implementation**

Create a real 1024×1024 PNG with sharp, then inspect the output:

```ts
it("creates a compact 256 square WebP for the 72px ingredient avatar", async () => {
  const input = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 216, g: 120, b: 68 } }
  }).png().toBuffer();
  const output = await optimizeIngredientImage(input);
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.width).toBe(256);
  expect(metadata.height).toBe(256);
  expect(output.byteLength).toBeLessThan(512 * 1024);
  expect(validateIngredientWebp(output)).toBe(output);
});
```

Also assert HTML/random bytes and a fake `RIFF` without `WEBP` at bytes 8–11 are rejected.

- [ ] **Step 3: Update service and route tests for the new cache contract**

Define a minimal header fixture for injected unit paths:

```ts
const WEBP = Buffer.concat([
  Buffer.from("RIFF"), Buffer.from([12, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from("VP8 "), Buffer.alloc(8)
]);
```

Update service tests so `generate` returns the existing valid PNG and injected `optimize` returns `WEBP`. Assert `optimize` receives the provider PNG once, simultaneous requests share both generation and optimization, the cached path is `<key>.webp`, and later cache hits call neither dependency.

Update corrupt/oversized cache tests to write `<key>.webp`. Add a case where optimization rejects: no cache hit may be created and the temporary file must not remain.

Update route success to expect `content-type: image/webp`, immutable cache control and unchanged ETag.

- [ ] **Step 4: Run image tests and verify RED**

Run:

```bash
npm run test -- tests/unit/ingredient-image-optimizer.test.ts tests/unit/ingredient-image-service.test.ts tests/unit/ingredient-image-route.test.ts
```

Expected: FAIL because optimizer, v2 cache extension and WebP MIME are not implemented.

- [ ] **Step 5: Implement the optimizer**

`src/lib/images/ingredient-image-optimizer.ts`:

```ts
import sharp from "sharp";

export const INGREDIENT_IMAGE_SIZE = 256;
const MAX_CACHE_BYTES = 512 * 1024;

export async function optimizeIngredientImage(png: Buffer) {
  const output = await sharp(png, { failOn: "error" })
    .rotate()
    .resize(INGREDIENT_IMAGE_SIZE, INGREDIENT_IMAGE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 60, effort: 4 })
    .toBuffer();
  return validateIngredientWebp(output);
}
```

`validateIngredientWebp` checks max 512 KiB, `RIFF` at bytes 0–3 and `WEBP` at bytes 8–11. Return the same Buffer on success and throw `食材图片压缩结果无效` for every format failure.

- [ ] **Step 6: Upgrade service to v2 WebP atomically**

In `ingredient-image-service.ts`:

- Set `VERSION = "v2"`.
- Keep provider output and provider validation as PNG.
- Default `optimize` to `optimizeIngredientImage`.
- `read` resolves `<key>.webp`, rejects cache files above 512 KiB, and uses `validateIngredientWebp`.
- `getOrCreate` calls `validatePng(await generate(...))`, then `validateIngredientWebp(await optimize(png))`, writes the WebP to `<key>.<uuid>.tmp`, and atomically renames it to `<key>.webp`.
- Never keep or serve the multi-megabyte provider PNG.
- Preserve the current in-flight cleanup for both resolution and rejection.

In `ingredient-image-route-handlers.ts`, rename the local read variable from `png` to `image`, keep `Uint8Array.from(image)`, and send `content-type: image/webp`.

- [ ] **Step 7: Run focused image tests and commit**

Run:

```bash
npm run test -- tests/unit/ingredient-image-optimizer.test.ts tests/unit/ingredient-image-service.test.ts tests/unit/ingredient-image-route.test.ts
```

Expected: all optimizer, provider, cache and route cases pass.

Commit:

```bash
git add package.json package-lock.json src/lib/images tests/unit/ingredient-image-optimizer.test.ts tests/unit/ingredient-image-service.test.ts tests/unit/ingredient-image-route.test.ts
git commit -m "perf: cache compact ingredient webp images"
```

---

### Task 3: One-Pass Integrated Mobile Acceptance

**Files:**

- Create: `tests/e2e/family-cooking-flow.spec.js`
- Create: `playwright.family.config.cjs`
- Modify: `package.json`
- Modify: `docs/qa/最终验收报告.md`

**Interfaces:**

- Consumes all completed tasks from this plan and `2026-07-19-family-gate-cloud-sharing.md`.
- Adds `npm run test:e2e:family` for one Chromium project at 390×844 with Reduced Motion.

- [ ] **Step 1: Add the focused Playwright configuration**

`playwright.family.config.cjs` must use one worker and one viewport. Generate a deterministic test-only scrypt hash at config load with Node `scryptSync`, fixed salt, and password `family-e2e-password`; pass it and a 32+ byte test session secret via `webServer.env`. Generate a unique database path with the following expression, set `AI_PROVIDER=mock`, and never use either user-provided real API key:

```js
const databasePath = join(tmpdir(), `laogong-caipu-family-e2e-${process.pid}.sqlite`);
```

The web-server command is only `npm run dev -- --hostname 127.0.0.1`; it must not delete or reuse a prior database.

Set:

```js
testMatch: "family-cooking-flow.spec.js",
projects: [{ name: "family-mobile-390", use: { viewport: { width: 390, height: 844 } } }],
use: { baseURL: "http://127.0.0.1:3000", reducedMotion: "reduce", trace: "retain-on-failure" }
```

Add `"test:e2e:family": "playwright test --config=playwright.family.config.cjs"` to package scripts.

- [ ] **Step 2: Write the single integrated flow**

The test must:

1. Visit `/recipes` anonymously and assert redirect to `/unlock?next=%2Frecipes`.
2. Enter `family-e2e-password`, submit “进入老公菜谱”, and assert return to `/recipes`.
3. Seed one recipe through the authenticated browser context with ingredients “排骨、姜、白芝麻”.
4. Intercept `**/api/recipes/*/ingredient-images`, hold its response, and navigate to the recipe's cooking mode.
5. Assert the visible ingredient avatar has `aria-busy=true`, `.cooking-ingredient-skeleton` is visible, and the page has no horizontal overflow.
6. Fulfill with a small deterministic image URL, wait for the real `<img>` to complete, and assert `aria-busy=false`.
7. Click “全部勾选”, assert every ingredient button has `aria-pressed=true`, then click “取消全选” and assert every one is false.
8. Navigate home, open “家庭菜单”, click “退出家庭”, and assert the unlock page appears; revisiting `/recipes` must remain locked.
9. Save only one new screenshot to `output/playwright-family-sharing/390/family-cooking.png` after the generated image appears.

Do not run the original three-width full screenshot suite in this task.

- [ ] **Step 3: Run the complete unit suite once**

Run:

```bash
npm run test
```

Expected: all unit files pass. Record exact file/test counts from this fresh run; do not reuse earlier counts.

- [ ] **Step 4: Run lint and production build once**

Run:

```bash
npm run lint
npm run build
```

Expected: both exit 0. Record exact warning count and generated route count. The build must show `/unlock`, `/api/auth/login`, `/api/auth/logout` and middleware without reading real secrets at build time.

- [ ] **Step 5: Run the single 390px flow once**

Run:

```bash
npm run test:e2e:family
```

Expected: 1/1 pass at 390×844. If it fails for a product defect, return the responsible task to its implementation agent, rerun only the failing unit file, and then rerun this one E2E. Do not loosen assertions or increase retries to hide a defect.

- [ ] **Step 6: Verify secrets and working-tree scope**

Run targeted scans without printing environment values:

```bash
git diff --check
git status --short
git diff --name-only 4a27c8d..HEAD
git grep -IlE "sk-[A-Za-z0-9_-]{12,}" -- .
```

Expected: `git diff --check` is clean; secret scan returns no tracked implementation or report file. Preserve all user-owned untracked artifacts.

- [ ] **Step 7: Update the final acceptance report**

Append a dated section to `docs/qa/最终验收报告.md` containing only fresh evidence:

- commit range and exact changed-file scope;
- family gate route/API/Cookie results without Cookie values;
- SQLite pragma and backup retention results;
- WebP dimensions, MIME and byte-size range from fixtures or live cache, without base64 data;
- skeleton, image replacement and toggle-all results;
- exact unit/lint/build/E2E counts;
- explicit statement that the user's cloud server was not modified and remains a separate deployment step;
- Claude Code copy/paste revalidation commands using test-only environment variables.

- [ ] **Step 8: Commit integrated evidence**

Commit:

```bash
git add playwright.family.config.cjs tests/e2e/family-cooking-flow.spec.js package.json package-lock.json docs/qa/最终验收报告.md
git commit -m "test: verify family cooking flow"
```

Do not commit screenshots unless the repository's existing policy explicitly tracks the new output directory; by default it remains an ignored/untracked QA artifact.
