# Family Password and Pull-to-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native-feeling, accessible recipe-list pull-to-refresh flow and rotate the running family gate to the user-selected shared password without storing plaintext.

**Architecture:** A focused `usePullToRefresh` hook owns touch recognition, Apple-style rubber-banding, interruptible motion and refresh phases. `RecipeList` keeps ownership of recipe loading and exposes its existing background refresh as a boolean-returning callback; the hook is integrated around only the movable list surface while shadcn's existing menu provides an equivalent non-touch action. Password rotation is a controller-only runtime operation after code review, not a repository configuration change.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Framer Motion 11, shadcn/Radix DropdownMenu, Lucide, Vitest, Testing Library.

## Global Constraints

- Never write the family password plaintext, a real session secret, Cookie value, or real AI key to tracked files, reports, logs or screenshots.
- Do not add dependencies. Reuse Framer Motion, Lucide, shadcn `DropdownMenuItem`, Sonner and the existing list API.
- Gesture constants are exact: 10px direction hysteresis, 64px raw commit threshold, Apple rubber-band constant `0.55`, 96px maximum visual displacement, 44px refresh hold position, 450ms completion acknowledgement, and a 0.35s no-overshoot spring return.
- Pull-to-refresh only engages at `window.scrollY <= 0`, while initial loading and refresh are both idle, and only for a dominant downward vertical gesture.
- Background refresh preserves the last successful cards, filters, selection and scroll state; errors keep those cards and use `同步失败，已保留当前菜谱`.
- Reduced motion removes large surface translation and elastic return but retains status/opacity feedback.
- Existing user-untracked browser/design/output artifacts must remain unmodified and unstaged.
- Verification is lean: focused hook/list tests, lint, diff/secret checks, one 390px mobile check; no full suite, build, real AI, Docker or cloud mutation.

---

### Task 1: Recipe-list pull-to-refresh

**Files:**
- Create: `src/hooks/use-pull-to-refresh.ts`
- Create: `tests/unit/use-pull-to-refresh.test.tsx`
- Modify: `src/components/recipe-list.tsx:3-158`
- Modify: `src/app/globals.css:153-270`
- Modify: `tests/unit/recipe-list-v3.test.tsx:1-395`

**Interfaces:**
- Consumes: `RecipeList.load({ background: true }): Promise<boolean>`, motion conventions from `src/lib/motion.ts`, Framer Motion `MotionValue<number>`, existing shadcn dropdown primitives and Sonner failure handling.
- Produces:

```ts
export type PullRefreshPhase = "idle" | "pulling" | "ready" | "refreshing" | "success" | "error";

export type UsePullToRefreshResult = {
  containerRef: React.RefObject<HTMLElement>;
  pullY: MotionValue<number>;
  phase: PullRefreshPhase;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

export function usePullToRefresh(options: {
  disabled: boolean;
  onRefresh: () => Promise<boolean>;
  onEngage?: () => void;
}): UsePullToRefreshResult;
```

- `refresh()` is shared by touch release and “更多 → 刷新菜谱”; it ignores duplicate calls while active.
- `onRefresh()` returns `true` only for the latest non-aborted successful request and `false` for failure or abort.

- [ ] **Step 1: Write failing hook gesture tests**

Create a harness in `tests/unit/use-pull-to-refresh.test.tsx` that renders hook state and attaches `containerRef`:

```tsx
function Harness({ onRefresh, disabled = false, onEngage = vi.fn() }: {
  onRefresh: () => Promise<boolean>;
  disabled?: boolean;
  onEngage?: () => void;
}) {
  const pull = usePullToRefresh({ disabled, onRefresh, onEngage });
  return (
    <main ref={pull.containerRef} data-testid="pull-root" aria-busy={pull.refreshing}>
      <span role="status">{pull.phase}</span>
      <button onClick={() => void pull.refresh()}>刷新</button>
    </main>
  );
}

function drag(fromY: number, toY: number, x = 120) {
  const root = screen.getByTestId("pull-root");
  fireEvent.touchStart(root, { touches: [{ clientX: x, clientY: fromY }] });
  fireEvent.touchMove(root, { touches: [{ clientX: x, clientY: toY }], cancelable: true });
  fireEvent.touchEnd(root, { changedTouches: [{ clientX: x, clientY: toY }] });
}
```

Add separate tests proving below-top rejection, below-64px rejection, dominant-horizontal rejection, `disabled`, a single engagement and request above 64px, duplicate suppression, `false` result → `error`, native-overscroll class cleanup on unmount, and reduced-motion `pullY=0`.

The threshold/duplicate test must include:

```tsx
const pending = deferred<boolean>();
const refresh = vi.fn().mockReturnValue(pending.promise);
const engage = vi.fn();
render(<Harness onRefresh={refresh} onEngage={engage} />);
drag(100, 180);
expect(engage).toHaveBeenCalledTimes(1);
expect(refresh).toHaveBeenCalledTimes(1);
expect(screen.getByTestId("pull-root")).toHaveAttribute("aria-busy", "true");
fireEvent.click(screen.getByRole("button", { name: "刷新" }));
expect(refresh).toHaveBeenCalledTimes(1);
pending.resolve(true);
```

- [ ] **Step 2: Run hook tests and verify RED**

Run:

```bash
npm run test -- tests/unit/use-pull-to-refresh.test.tsx
```

Expected: FAIL because `@/hooks/use-pull-to-refresh` does not exist. Record the failure command and count in `.superpowers/sdd/pull-refresh-report.md`.

- [ ] **Step 3: Implement the minimal hook**

Implement `src/hooks/use-pull-to-refresh.ts` with these constants and formula:

```ts
const HYSTERESIS = 10;
const COMMIT_THRESHOLD = 64;
const MAX_PULL = 96;
const HOLD_Y = 44;
const RUBBER_BAND = 0.55;
const ACK_MS = 450;

function rubberBand(raw: number, viewport: number) {
  const distance = (raw * viewport * RUBBER_BAND) /
    (viewport + RUBBER_BAND * Math.abs(raw));
  return Math.min(MAX_PULL, Math.max(0, distance));
}
```

Use native `touchstart`, non-passive `touchmove`, `touchend` and `touchcancel` listeners on `containerRef.current`. Record start X/Y only when enabled, idle and at the top. After 10px, reject horizontal/upward intent; for downward intent call `onEngage` once, `preventDefault()`, stop the current animation, set `phase` to `pulling`/`ready`, and update `pullY` directly. On release, call `refresh()` only when raw distance reached 64px; otherwise spring from the current motion value to zero.

`refresh()` uses an in-flight ref, sets `refreshing`, moves to 44px unless reduced motion is active, awaits the boolean callback, exposes `success`/`error` for 450ms, then springs to zero. Store animation/timer handles and an unmounted flag; stop/clear them in cleanup. While mounted, add `has-pull-to-refresh` to `document.documentElement` and remove it on cleanup.

Use Framer Motion `animate`, `useMotionValue`, `useReducedMotion`; return animation options are exact:

```ts
{ type: "spring", bounce: 0, duration: 0.35 }
```

- [ ] **Step 4: Run hook tests and verify GREEN**

Run the Step 2 command again.

Expected: all hook test cases PASS; no state-after-unmount warning.

- [ ] **Step 5: Write failing RecipeList integration tests**

Extend `tests/unit/recipe-list-v3.test.tsx` with a menu refresh test:

```tsx
it("refreshes from the shadcn menu without hiding current cards", async () => {
  const refreshed = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
  state.recipes
    .mockResolvedValueOnce({ recipes: [recipe(1, { name: "旧菜谱" })] })
    .mockReturnValueOnce(refreshed.promise);
  render(<RecipeList />);
  await screen.findByRole("button", { name: "查看菜谱 旧菜谱" });
  fireEvent.click(screen.getByRole("button", { name: "更多" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "刷新菜谱" }));
  expect(screen.getByRole("button", { name: "查看菜谱 旧菜谱" })).toBeInTheDocument();
  expect(screen.queryByLabelText("菜谱加载中")).not.toBeInTheDocument();
  expect(screen.getByTestId("recipe-list-v3")).toHaveAttribute("aria-busy", "true");
  act(() => refreshed.resolve({ recipes: [recipe(2, { name: "共享新菜谱" })] }));
  expect(await screen.findByRole("button", { name: "查看菜谱 共享新菜谱" })).toBeInTheDocument();
});
```

Add a failure case asserting the old card remains and the existing sync-failure toast fires. Add a long-press regression: start the card pointer timer, engage a valid top pull before 500ms, advance the timer, and assert the management bar never appears. Assert live status copy and `aria-busy`.

- [ ] **Step 6: Run list tests and verify RED**

Run:

```bash
npm run test -- tests/unit/recipe-list-v3.test.tsx
```

Expected: the new tests FAIL because “刷新菜谱”, pull status and `aria-busy` are absent and `load()` does not return a boolean.

- [ ] **Step 7: Integrate hook, shadcn fallback and Apple motion**

Change `RecipeList.load` to return `Promise<boolean>` while retaining existing branches:

```ts
if (next.signal.aborted) return false;
// apply the successful result
return true;
// catch branch
if (next.signal.aborted) return false;
// preserve current toast/error handling
return false;
```

Initialize the hook with the existing function declaration `clearLongPress` as its engagement callback:

```ts
const pull = usePullToRefresh({
  disabled: loading,
  onRefresh: () => load({ background: true }),
  onEngage: clearLongPress
});
```

Attach `pull.containerRef` and `aria-busy={pull.refreshing}` to `<main>`. Add an absolutely positioned `role="status" aria-live="polite"` indicator using Lucide `ArrowDown`, `RefreshCw`, `Check` and `CircleAlert`, with copy mapped exactly to `下拉刷新`, `松开刷新`, `正在同步`, `已更新`, `同步失败`.

Wrap only header/search/segments/chips/loading/results/delete status in a `motion.div` using `style={{ y: pull.pullY }}`. Keep fixed FAB, management bar, dialogs and drawers outside that transformed surface.

Add the first shadcn menu item:

```tsx
<DropdownMenuItem disabled={loading || pull.refreshing} onSelect={() => {
  setMoreOpen(false);
  void pull.refresh();
}}>
  刷新菜谱
</DropdownMenuItem>
```

Add CSS for `.v3-pull-indicator`, `.v3-pull-surface`, ready/success/error colors, spinner and native-refresh suppression:

```css
html.has-pull-to-refresh { overscroll-behavior-y: none; }

@media (prefers-reduced-motion: reduce) {
  .v3-pull-surface { transform: none !important; }
  .v3-pull-indicator svg { animation: none !important; }
}
```

- [ ] **Step 8: Verify GREEN and lean quality gates**

Run:

```bash
npm run test -- tests/unit/use-pull-to-refresh.test.tsx tests/unit/recipe-list-v3.test.tsx
npm run lint
git diff --check
```

Expected: both focused files PASS; lint exit 0 with no new errors; diff check clean. Run a tracked secret scan that prints only candidate counts and confirm the target password plaintext is absent from the staged diff.

- [ ] **Step 9: Self-review and commit exact scope**

Review duplicate requests, listener cleanup, stale promises, reduced motion, long-press conflicts, transformed fixed descendants and user-untracked files. Stage only these five files:

```bash
git add src/hooks/use-pull-to-refresh.ts \
  src/components/recipe-list.tsx \
  src/app/globals.css \
  tests/unit/use-pull-to-refresh.test.tsx \
  tests/unit/recipe-list-v3.test.tsx
git commit -m "feat: add recipe pull to refresh"
```

Write RED/GREEN counts, lint result, exact paths and commit to `.superpowers/sdd/pull-refresh-report.md`.

## Controller-only completion after Task 1 review

After the independent task reviewer returns Spec PASS and Quality APPROVED:

1. Run one focused 390px mobile check at the reviewed commit: top pull below threshold, top pull above threshold, menu refresh, horizontal chip scroll, card tap and long press; record no horizontal overflow and no runtime errors.
2. Stop the current local dev session.
3. Generate the scrypt hash from the password supplied in the conversation without writing plaintext to disk or output; generate a fresh random session secret without printing it.
4. Restart the existing dev service on `0.0.0.0:3000`, preserving the existing local database and AI environment while overriding only `FAMILY_PASSWORD_HASH` and `FAMILY_SESSION_SECRET` in process memory.
5. Verify `/api/health`, confirm an old Cookie is rejected, and confirm a fresh login with the new password succeeds without printing Cookie/session values.
6. Give the user the LAN URL and ask both phones to unlock again. Future cloud provisioning must use the same password through the existing interactive secret flow, never a tracked value.
