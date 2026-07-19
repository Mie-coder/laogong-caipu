# Family Gate and Cloud Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为老公菜谱增加服务端家庭密码门禁、30 天安全会话、适合两台手机共享的持久化 SQLite 运行方式，以及可复验的云服务器部署与备份配置。

**Architecture:** 单实例 Next.js 继续读写唯一 SQLite 文件，页面和 API 由 Edge-compatible HMAC 会话中间件统一保护；密码只在 Node.js 登录 route 中通过 scrypt 校验。云端运行使用 Docker 挂载持久化 `data` 与 `backups` 目录，前台恢复时对菜谱列表和详情做一次节流的后台刷新。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、Node.js 20.9+ Web Crypto 与 scrypt、SQLite/better-sqlite3、shadcn/ui、Vitest、Testing Library、Docker Compose、Nginx/Caddy。

## Global Constraints

- 只实现一个家庭共享密码，不新增用户表、家庭表、成员身份、个人收藏或角色权限。
- 家庭会话有效期固定为 30 天；Cookie 必须是 `HttpOnly`、生产环境 `Secure`、`SameSite=Lax`、`Path=/`。
- 家庭密码只以带随机盐的 scrypt 摘要保存在 `FAMILY_PASSWORD_HASH`；会话签名使用独立的 `FAMILY_SESSION_SECRET`，至少 32 字节。
- 家庭密码长度在 CLI、摘要验证和登录 route 中统一按 8–128 个 Unicode code points 校验，不得使用 UTF-16 `string.length` 作为 route 边界。
- 密码、用户输入、Cookie、会话令牌、DeepSeek Key 和 Micu Key不得写入日志、Git、客户端 bundle、数据库或 API 响应。
- `/unlock`、`/api/auth/login`、`/api/auth/logout`、`/api/health` 与 Next.js 必需静态资源可匿名访问；其他页面及 API 全部 fail closed。
- 登录同一来源 15 分钟内失败 5 次后限流；成功登录清除该来源失败记录。
- 所有携带家庭 Cookie 的 `POST`、`PUT`、`PATCH`、`DELETE` 业务请求必须通过统一同源 `Origin` 校验；登录和退出接口执行同一规则。
- 菜谱、收藏、做菜次数、复盘和已生成食材图在服务器共享；步骤、计时器、语音、备料勾选和导入草稿继续留在当前手机。
- SQLite 必须启用 `foreign_keys=ON`、`journal_mode=WAL`、`busy_timeout=5000`，并保持单实例写入。
- 通用交互复用 shadcn/ui；家庭解锁和退出操作保留 `data-press-feedback="apple"`，Reduced Motion 下不增加强动效。
- 云部署目录必须持久化 SQLite 与 `data/generated`；每日数据库备份保留 7 份，每周图片备份保留 4 份。
- 只执行每个任务的定向测试；所有任务完成后才运行一次 lint、一次 build 和一次完整测试集。
- 保留用户未跟踪的 `DESIGN.md`、`docs/ui-concepts/09-12`、`.playwright-cli/` 与全部 `output/` 证据，不得删除、覆盖或纳入提交。

---

## File Structure

### New files

- `src/lib/auth/constants.ts`：Cookie 名、30 天 TTL、登录限制和公开路径常量。
- `src/lib/auth/config.ts`：严格读取并校验服务端家庭鉴权环境变量。
- `src/lib/auth/password.ts`：Node-only scrypt 摘要编码与恒定时间校验。
- `src/lib/auth/session.ts`：仅使用 Web Crypto 的 HMAC 会话签发和验证，可在 Node 与 Edge 共用。
- `src/lib/auth/login-rate-limit.ts`：有容量上限的单实例失败计数器。
- `src/lib/auth/route-handlers.ts`：可注入依赖的登录、退出 handler factory。
- `src/lib/auth/family-gate.ts`：可测试的页面/API 门禁与安全返回路径。
- `src/middleware.ts`：调用可测试门禁并声明 matcher。
- `src/app/api/auth/login/route.ts`、`src/app/api/auth/logout/route.ts`：Next-compatible HTTP exports。
- `src/app/api/health/route.ts`：无敏感内容的存活检查。
- `src/app/unlock/page.tsx`、`src/components/auth/unlock-form.tsx`：家庭解锁页面。
- `src/components/auth/family-menu.tsx`：首页退出家庭入口。
- `src/hooks/use-foreground-refresh.ts`：前台恢复节流刷新。
- `scripts/hash-family-password.mjs`：输出 scrypt 摘要。
- `scripts/backup-data.mjs`：SQLite online backup、图片目录快照与保留策略。
- `Dockerfile`、`compose.yaml`、`.dockerignore`：单实例持久化部署。
- `docs/deployment/cloud-server.md`：环境、反代、备份、恢复和升级手册。
- `tests/unit/family-auth.test.ts`、`tests/unit/family-auth-routes.test.ts`、`tests/unit/family-gate.test.ts`、`tests/unit/family-auth-ui.test.tsx`：家庭鉴权回归。
- `tests/unit/db-client.test.ts`、`tests/unit/foreground-refresh.test.tsx`、`tests/unit/deployment-contract.test.ts`：持久化与部署契约。

### Modified files

- `src/lib/http/api-client.ts`：家庭登录和退出客户端函数。
- `src/components/home/home-screen.tsx`：放置家庭菜单。
- `src/components/recipe-list.tsx`、`src/components/recipe-detail.tsx`：前台恢复时后台刷新且保留旧数据。
- `src/lib/db/client.ts`：集中初始化 SQLite pragmas。
- `src/app/globals.css`：家庭解锁与加载状态样式。
- `.env.example`：新增无值的家庭鉴权和图片环境变量名。
- `package.json`、`package-lock.json`：增加摘要与备份命令；Node engine 收紧为 `>=20.9 <21`。
- `.gitignore`：忽略 `.env.production`、`backups/` 与运行时持久化内容。
- `README.md`：把“本地单人”边界更新为家庭共享和云部署入口。
- `docs/qa/最终验收报告.md`：只在最终集成任务补充有效证据。

---

### Task 1: Family Password and Session Primitives

**Files:**

- Create: `src/lib/auth/constants.ts`
- Create: `src/lib/auth/config.ts`
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/login-rate-limit.ts`
- Create: `scripts/hash-family-password.mjs`
- Create: `tests/unit/family-auth.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces:

```ts
export const FAMILY_COOKIE_NAME = "laogong_family_session";
export const FAMILY_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export type FamilyAuthConfig = { passwordHash: string; sessionSecret: string };
export function readFamilyAuthConfig(env?: NodeJS.ProcessEnv): FamilyAuthConfig;
export function hashFamilyPassword(password: string, salt?: Buffer): Promise<string>;
export function verifyFamilyPassword(password: string, encoded: string): Promise<boolean>;
export function createFamilySession(secret: string, nowMs?: number): Promise<string>;
export function verifyFamilySession(token: string, secret: string, nowMs?: number): Promise<boolean>;
export function createLoginRateLimiter(options?: { now?: () => number }): {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  reset(key: string): void;
};
```

- Session token wire format: `<base64url({"v":1,"exp":unixSeconds})>.<base64url(HMAC-SHA256)>`.
- Password hash wire format: `scrypt$<base64url-16-byte-salt>$<base64url-64-byte-derived-key>`.

- [ ] **Step 1: Write failing primitive tests**

Create `tests/unit/family-auth.test.ts` with these concrete cases:

```ts
it("hashes and verifies a family password without storing plaintext", async () => {
  const encoded = await hashFamilyPassword("我们两个人的长密码", Buffer.alloc(16, 7));
  expect(encoded).toMatch(/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  expect(encoded).not.toContain("我们两个人的长密码");
  await expect(verifyFamilyPassword("我们两个人的长密码", encoded)).resolves.toBe(true);
  await expect(verifyFamilyPassword("错误密码", encoded)).resolves.toBe(false);
  await expect(verifyFamilyPassword("任意", "损坏摘要")).resolves.toBe(false);
});

it("accepts only an untampered unexpired 30 day session", async () => {
  const secret = "s".repeat(32);
  const token = await createFamilySession(secret, 1_700_000_000_000);
  await expect(verifyFamilySession(token, secret, 1_700_000_001_000)).resolves.toBe(true);
  await expect(verifyFamilySession(`${token}x`, secret, 1_700_000_001_000)).resolves.toBe(false);
  await expect(verifyFamilySession(token, secret, 1_700_000_000_000 + 30 * 86_400_000 + 1)).resolves.toBe(false);
});

it("blocks the fifth failed login for 15 minutes and resets on success", () => {
  let now = 1_000;
  const limiter = createLoginRateLimiter({ now: () => now });
  for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure("203.0.113.7");
  expect(limiter.isBlocked("203.0.113.7")).toBe(true);
  limiter.reset("203.0.113.7");
  expect(limiter.isBlocked("203.0.113.7")).toBe(false);
  for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure("203.0.113.7");
  now += 15 * 60_000 + 1;
  expect(limiter.isBlocked("203.0.113.7")).toBe(false);
});
```

Also assert `readFamilyAuthConfig` rejects a missing hash, malformed hash, or a session secret whose UTF-8 encoding is shorter than 32 bytes without including any supplied secret in the error message.

- [ ] **Step 2: Run the primitive test and verify RED**

Run:

```bash
npm run test -- tests/unit/family-auth.test.ts
```

Expected: FAIL because `@/lib/auth/*` does not exist.

- [ ] **Step 3: Implement password and config primitives**

Use Node's asynchronous scrypt and constant-time comparison:

```ts
const SCRYPT_KEY_LENGTH = 64;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}

export async function verifyFamilyPassword(password: string, encoded: string) {
  const parsed = parseFamilyPasswordHash(encoded);
  const characterCount = Array.from(password).length;
  if (!parsed || characterCount < 8 || characterCount > 128) return false;
  const actual = await derive(password, parsed.salt);
  return actual.length === parsed.digest.length && timingSafeEqual(actual, parsed.digest);
}
```

`readFamilyAuthConfig` must validate both variables at request time, return only `{ passwordHash, sessionSecret }`, and throw the fixed message `家庭门禁配置无效` for every invalid configuration.

- [ ] **Step 4: Implement the Edge-compatible session token**

`src/lib/auth/session.ts` must use only `globalThis.crypto.subtle`, `TextEncoder`, `Uint8Array`, `atob` and `btoa`; it must not import `node:crypto` or `Buffer` so middleware can bundle it:

```ts
type SessionPayload = { v: 1; exp: number };

export async function createFamilySession(secret: string, nowMs = Date.now()) {
  const payload: SessionPayload = { v: 1, exp: Math.floor(nowMs / 1000) + FAMILY_SESSION_TTL_SECONDS };
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload, secret)}`;
}
```

`verifyFamilySession` must reject extra segments, malformed base64/JSON, wrong version, non-integer expiry, expiry at or before `now`, and invalid HMAC via `crypto.subtle.verify`.

- [ ] **Step 5: Implement the bounded login limiter**

Store `{ failures: number; blockedUntil: number; touchedAt: number }` in a `Map`. Prune expired entries before every lookup, cap the map at 1,000 entries by deleting the oldest `touchedAt`, and start the 15-minute block when the fifth failure is recorded. No password or request body may enter the key or value.

- [ ] **Step 6: Add the password hash command**

Create `scripts/hash-family-password.mjs` with an interactive TTY prompt that switches stdin to raw mode and prints one mask character per entered character. Reject non-TTY interactive use, restore raw mode in `finally`, reject passwords outside 8–128 Unicode code points, write only the final `scrypt$...` value to stdout, and never echo or write the plaintext.

Add:

```json
"auth:hash": "node scripts/hash-family-password.mjs"
```

to `package.json` scripts. The deployment document will instruct the user to paste the output into the server environment; the command must not edit `.env` itself.

- [ ] **Step 7: Run primitive tests and commit**

Run:

```bash
npm run test -- tests/unit/family-auth.test.ts
```

Expected: PASS with all family primitive cases green.

Commit only Task 1 files:

```bash
git add package.json scripts/hash-family-password.mjs src/lib/auth tests/unit/family-auth.test.ts
git commit -m "feat: add family auth primitives"
```

---

### Task 2: Protected Routes, Login API, and Health Check

**Files:**

- Create: `src/lib/auth/route-handlers.ts`
- Create: `src/lib/auth/family-gate.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/middleware.ts`
- Create: `tests/unit/family-auth-routes.test.ts`
- Create: `tests/unit/family-gate.test.ts`

**Interfaces:**

- Consumes Task 1 constants, config, password verifier, session signer/verifier and rate limiter.
- Produces:

```ts
export type LoginHandlerDeps = {
  readConfig: () => FamilyAuthConfig;
  verifyPassword: (password: string, encoded: string) => Promise<boolean>;
  createSession: (secret: string) => Promise<string>;
  limiter: ReturnType<typeof createLoginRateLimiter>;
};
export function createFamilyLoginHandler(deps: LoginHandlerDeps): (request: Request) => Promise<Response>;
export function createFamilyLogoutHandler(): (request: Request) => Promise<Response>;
export function sanitizeReturnPath(value: string | null): string;
export async function applyFamilyGate(request: NextRequest, secret: string | undefined): Promise<NextResponse>;
```

- Login body: `{ "password": string }`; success: `{ "ok": true }` plus secure Cookie.
- Logout is POST only; success: `{ "ok": true }` plus an expired Cookie.
- Health GET response is exactly `{ "ok": true }` and `cache-control: no-store`.

- [ ] **Step 1: Write failing route tests**

Create `tests/unit/family-auth-routes.test.ts` and cover:

```ts
it("sets a 30 day HttpOnly family cookie after a correct same-origin login", async () => {
  const POST = createFamilyLoginHandler({
    readConfig: () => ({ passwordHash: "encoded", sessionSecret: "s".repeat(32) }),
    verifyPassword: vi.fn().mockResolvedValue(true),
    createSession: vi.fn().mockResolvedValue("payload.signature"),
    limiter: createLoginRateLimiter()
  });
  const response = await POST(loginRequest("正确家庭密码"));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain(`${FAMILY_COOKIE_NAME}=payload.signature`);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
  expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
});
```

Also assert wrong passwords return 401 with the same generic message, blocked sources return 429, malformed/cross-origin requests return 400/403, missing configuration returns 503 without secrets, and logout expires the cookie.

- [ ] **Step 2: Write failing gate tests**

Create `tests/unit/family-gate.test.ts` using `NextRequest`:

```ts
it("redirects an anonymous page but returns JSON 401 for an anonymous API", async () => {
  const page = await applyFamilyGate(new NextRequest("https://recipes.example/recipes/7"), "s".repeat(32));
  expect(page.status).toBe(307);
  expect(page.headers.get("location")).toBe("https://recipes.example/unlock?next=%2Frecipes%2F7");

  const api = await applyFamilyGate(new NextRequest("https://recipes.example/api/recipes/7"), "s".repeat(32));
  expect(api.status).toBe(401);
  await expect(api.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
});
```

Mock `verifyFamilySession` or sign a real token and assert: valid session passes through, expired/tampered session fails, `/unlock`, auth routes, health and `/_next/static/...` pass anonymously, and `sanitizeReturnPath` accepts only same-site paths starting with one `/` and rejects `//evil.test`, absolute URLs and `/unlock` loops.

Add one authenticated unsafe-method case: a valid Cookie on a cross-origin `PATCH /api/recipes/7/favorite` returns 403, while the same request with `Origin: https://recipes.example` passes through. `GET`, `HEAD` and `OPTIONS` do not require an Origin header.

- [ ] **Step 3: Run both test files and verify RED**

Run:

```bash
npm run test -- tests/unit/family-auth-routes.test.ts tests/unit/family-gate.test.ts
```

Expected: FAIL because handler factories and middleware gate do not exist.

- [ ] **Step 4: Implement login and logout factories**

Parse login input with:

```ts
const PasswordSchema = z.string().refine((password) => {
  const count = Array.from(password).length;
  return count >= 8 && count <= 128;
});
const LoginSchema = z.object({ password: PasswordSchema }).strict();
```

Derive the limiter key from the proxy-overwritten first `x-forwarded-for` value, otherwise `x-real-ip`, otherwise `unknown`; trim it to 128 characters. Compare `Origin` to `new URL(request.url).origin`. On success set the Cookie using `NextResponse.json(...).cookies.set` with the exact attributes in Global Constraints. In production set `secure: true`; tests and local HTTP may set it based on `NODE_ENV === "production"`.

- [ ] **Step 5: Implement the family gate and Next middleware**

`applyFamilyGate` must:

1. Bypass only the explicit public paths, `/_next/static/` and the exact `/_next/image` endpoint; do not bypass the whole `/_next/` namespace.
2. Fail closed when `FAMILY_SESSION_SECRET` is absent or its UTF-8 encoding is shorter than 32 bytes.
3. Verify `request.cookies.get(FAMILY_COOKIE_NAME)?.value`.
4. Return `NextResponse.next()` for a valid session.
5. For a valid session on `POST`, `PUT`, `PATCH` or `DELETE`, require `Origin` to equal `request.nextUrl.origin`; otherwise return JSON 403 before the business route runs.
6. Return JSON 401 for protected `/api/` paths.
7. Redirect protected pages to `/unlock?next=<encoded pathname+search>`.

`src/middleware.ts` must only call this function and export a matcher that excludes common file extensions without excluding business image API routes:

```ts
export async function middleware(request: NextRequest) {
  return applyFamilyGate(request, process.env.FAMILY_SESSION_SECRET);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"]
};
```

- [ ] **Step 6: Implement route exports and health endpoint**

App route files must export only `POST` or `GET`, with factories and other helpers remaining under `src/lib/auth/`. Keep the prior Next build regression guard pattern: add a test asserting auth route module keys contain only their supported HTTP method.

- [ ] **Step 7: Run auth route tests and commit**

Run:

```bash
npm run test -- tests/unit/family-auth.test.ts tests/unit/family-auth-routes.test.ts tests/unit/family-gate.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/middleware.ts src/lib/auth src/app/api/auth src/app/api/health tests/unit/family-auth-routes.test.ts tests/unit/family-gate.test.ts
git commit -m "feat: protect family pages and APIs"
```

---

### Task 3: Family Unlock UI and Logout Entry

**Files:**

- Create: `src/app/unlock/page.tsx`
- Create: `src/components/auth/unlock-form.tsx`
- Create: `src/components/auth/family-menu.tsx`
- Create: `tests/unit/family-auth-ui.test.tsx`
- Modify: `src/lib/http/api-client.ts`
- Modify: `src/components/home/home-screen.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**

- Consumes Task 2 login/logout endpoints.
- Produces:

```ts
export function unlockFamilyApi(password: string): Promise<{ ok: true }>;
export function logoutFamilyApi(): Promise<{ ok: true }>;
export function UnlockForm({ returnTo }: { returnTo: string }): JSX.Element;
export function FamilyMenu(): JSX.Element;
```

- [ ] **Step 1: Write failing UI tests**

Mock `next/navigation` and API client functions, then add:

```tsx
it("submits the family password once and returns to the protected page", async () => {
  unlockFamilyApi.mockResolvedValue({ ok: true });
  render(<UnlockForm returnTo="/recipes/7" />);
  fireEvent.change(screen.getByLabelText("家庭密码"), { target: { value: "我们两个人的长密码" } });
  fireEvent.click(screen.getByRole("button", { name: "进入老公菜谱" }));
  await waitFor(() => expect(unlockFamilyApi).toHaveBeenCalledWith("我们两个人的长密码"));
  expect(replace).toHaveBeenCalledWith("/recipes/7");
  expect(refresh).toHaveBeenCalled();
});

it("shows a generic error and keeps the password out of rendered output", async () => {
  unlockFamilyApi.mockRejectedValue(new ApiError("invalid_credentials", "家庭密码不正确", 401));
  render(<UnlockForm returnTo="/" />);
  fireEvent.change(screen.getByLabelText("家庭密码"), { target: { value: "不会出现在页面" } });
  fireEvent.click(screen.getByRole("button", { name: "进入老公菜谱" }));
  expect(await screen.findByRole("status")).toHaveTextContent("家庭密码不正确");
  expect(document.body.textContent).not.toContain("不会出现在页面");
});

it("logs out from the shadcn family menu", async () => {
  logoutFamilyApi.mockResolvedValue({ ok: true });
  render(<FamilyMenu />);
  fireEvent.click(screen.getByRole("button", { name: "家庭菜单" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "退出家庭" }));
  await waitFor(() => expect(logoutFamilyApi).toHaveBeenCalled());
  expect(replace).toHaveBeenCalledWith("/unlock");
});
```

Also assert the password input uses `type=password`, `autoComplete=current-password`, all actions use shadcn Button/DropdownMenu, and the primary actions carry Apple press feedback.

- [ ] **Step 2: Run the UI test and verify RED**

Run:

```bash
npm run test -- tests/unit/family-auth-ui.test.tsx
```

Expected: FAIL because unlock UI and client APIs do not exist.

- [ ] **Step 3: Add typed client APIs**

Extend `src/lib/http/api-client.ts`:

```ts
const OkResponseSchema = z.object({ ok: z.literal(true) });
export function unlockFamilyApi(password: string) {
  return requestJson("/api/auth/login", OkResponseSchema, { method: "POST", body: JSON.stringify({ password }) });
}
export function logoutFamilyApi() {
  return requestJson("/api/auth/logout", OkResponseSchema, { method: "POST", body: "{}" });
}
```

Do not persist the password in React state after success, URL parameters, localStorage, sessionStorage, analytics or logs.

- [ ] **Step 4: Implement the unlock page and form**

`src/app/unlock/page.tsx` reads `searchParams.next`, passes it through the same `sanitizeReturnPath`, and renders a centered branded surface without `AppShell` or bottom navigation. `UnlockForm` owns password, pending and error state; on submit it calls the client API, clears password in both success and failure paths, then `router.replace(returnTo)` and `router.refresh()` on success.

Use the existing shadcn `Input` and `Button`; add a show/hide icon button with `aria-label` changing between “显示密码” and “隐藏密码”. The form must have a real `<form onSubmit>` so mobile keyboard submission works.

- [ ] **Step 5: Add the family menu to the homepage**

Place `FamilyMenu` beside the current history button in `.v3-home-header`. It uses shadcn `DropdownMenu`, a shadcn icon Button labeled “家庭菜单”, and a “退出家庭” item. On successful POST logout, replace the route with `/unlock` and refresh. On failure, show a non-secret status message and remain on the page.

- [ ] **Step 6: Add restrained responsive styling**

Add `.family-unlock-*` rules using existing canvas/surface/primary tokens. The card width is `min(100% - 2rem, 24rem)`, actions are at least 44px, and the only entrance motion is the existing short page transition. Under `prefers-reduced-motion`, disable the password visibility icon transition and all loading transforms.

- [ ] **Step 7: Run UI tests and commit**

Run:

```bash
npm run test -- tests/unit/family-auth-ui.test.tsx tests/unit/home-v3.test.tsx tests/unit/api-client.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/app/unlock src/components/auth src/components/home/home-screen.tsx src/lib/http/api-client.ts src/app/globals.css tests/unit/family-auth-ui.test.tsx
git commit -m "feat: add family unlock experience"
```

---

### Task 4: SQLite Concurrency and Foreground Refresh

**Files:**

- Create: `src/hooks/use-foreground-refresh.ts`
- Create: `tests/unit/db-client.test.ts`
- Create: `tests/unit/foreground-refresh.test.tsx`
- Modify: `src/lib/db/client.ts`
- Modify: `src/components/recipe-list.tsx`
- Modify: `src/components/recipe-detail.tsx`
- Modify: `tests/unit/recipe-list-v3.test.tsx`
- Modify: `tests/unit/recipe-detail-v3.test.tsx`

**Interfaces:**

```ts
export function configureDatabase(db: Database.Database): void;
export function useForegroundRefresh(refresh: () => void, options?: { minIntervalMs?: number }): void;
```

- [ ] **Step 1: Write the SQLite pragma test**

Use a temporary on-disk database because in-memory SQLite cannot enter WAL mode:

```ts
it("configures the shared database for foreign keys, WAL, and a 5 second busy timeout", async () => {
  const root = await mkdtemp(join(tmpdir(), "laogong-db-"));
  const db = new Database(join(root, "test.sqlite"));
  configureDatabase(db);
  expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
  expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
  db.close();
  await rm(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Write the foreground hook test**

Render a probe component, mock `document.visibilityState`, and assert one refresh when the document becomes visible; a following `focus` event inside 1,000ms must not duplicate it, while an event after the interval must refresh again. Unmount and assert later events do nothing.

- [ ] **Step 3: Run both new tests and verify RED**

Run:

```bash
npm run test -- tests/unit/db-client.test.ts tests/unit/foreground-refresh.test.tsx
```

Expected: FAIL because `configureDatabase` and `useForegroundRefresh` do not exist.

- [ ] **Step 4: Implement database configuration and hook**

Call `configureDatabase(singleton)` immediately after opening the database and before `migrate`. The hook stores the latest callback in a ref, listens to both `document.visibilitychange` and `window.focus`, runs only when visible, and uses a monotonic last-run timestamp to collapse paired events within `minIntervalMs` (default 1,000ms).

- [ ] **Step 5: Add list/detail background refresh regression tests**

For `RecipeList`, resolve the first request with recipe A, dispatch a foreground event, resolve the second request with recipe B, and assert B appears. Then make a foreground refresh reject and assert the last successful cards remain rendered.

For `RecipeDetail`, resolve the first request with `cookedCount: 3`, foreground the page, resolve with `cookedCount: 4`, and assert the summary updates. Reject a later foreground request and assert the detail remains visible with the non-blocking text “同步失败，已保留当前菜谱”.

- [ ] **Step 6: Implement background-safe loading**

Refactor each component's `load` into `useCallback` with `{ background?: boolean }`:

- Initial/manual retry may show existing loading and full-page error states.
- Background refresh must not clear `recipes` or `recipe`, must not show a skeleton, and must retain the last successful data on failure.
- List failures use the existing Sonner surface with `toast.error("同步失败，已保留当前菜谱")`.
- Detail failures set the existing `notice` region to `同步失败，已保留当前菜谱`.
- Every refresh remains cancellable; unmount aborts list requests and ignores settled detail requests via a local cancellation generation.

- [ ] **Step 7: Run focused sync tests and commit**

Run:

```bash
npm run test -- tests/unit/db-client.test.ts tests/unit/foreground-refresh.test.tsx tests/unit/recipe-list-v3.test.tsx tests/unit/recipe-detail-v3.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/lib/db/client.ts src/hooks/use-foreground-refresh.ts src/components/recipe-list.tsx src/components/recipe-detail.tsx tests/unit/db-client.test.ts tests/unit/foreground-refresh.test.tsx tests/unit/recipe-list-v3.test.tsx tests/unit/recipe-detail-v3.test.tsx
git commit -m "feat: refresh shared recipes on foreground"
```

---

### Task 5: Persistent Deployment and Backup Contract

**Files:**

- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `.dockerignore`
- Create: `scripts/backup-data.mjs`
- Create: `docs/deployment/cloud-server.md`
- Create: `tests/unit/deployment-contract.test.ts`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

**Interfaces:**

- Container listens on `0.0.0.0:3000` but Compose publishes only `127.0.0.1:3000:3000` for reverse proxy access.
- Container mounts `./data:/app/data` and `./backups:/app/backups`.
- Backup commands:

```bash
npm run backup -- --kind daily
npm run backup -- --kind weekly
npm run backup -- --kind predeploy
```

- [ ] **Step 1: Write the deployment contract test**

Create a file-based test that reads the deployment assets and asserts:

```ts
expect(compose).toContain("127.0.0.1:3000:3000");
expect(compose).toContain("./data:/app/data");
expect(compose).toContain("./backups:/app/backups");
expect(dockerfile).toContain("node:20-bookworm-slim");
expect(envExample).toContain("FAMILY_PASSWORD_HASH=");
expect(envExample).toContain("FAMILY_SESSION_SECRET=");
expect(envExample).toContain("MICU_API_KEY=");
expect(gitignore).toContain(".env.production");
expect(gitignore).toContain("backups/");
```

Spawn `node scripts/backup-data.mjs --kind daily` against a temporary SQLite file with one row, then open the produced backup with better-sqlite3 and assert the row exists. Run eight dated daily backups using an injected `BACKUP_NOW` only in tests and assert only seven remain.

- [ ] **Step 2: Run deployment test and verify RED**

Run:

```bash
npm run test -- tests/unit/deployment-contract.test.ts
```

Expected: FAIL because deployment assets and backup script do not exist.

- [ ] **Step 3: Add the runtime dependency and engine contract**

Do not add a new deployment framework. Set:

```json
"engines": { "node": ">=20.9 <21" },
"scripts": { "backup": "node scripts/backup-data.mjs" }
```

Retain all existing scripts. `package-lock.json` must be updated by npm, not edited manually.

Run `npm install --package-lock-only` after editing `package.json`, then confirm the root package metadata in `package-lock.json` contains the same engine range. Do not execute this step concurrently with Ingredient Image Task 2, because both tasks own `package.json` and `package-lock.json`.

- [ ] **Step 4: Implement online backup and retention**

`scripts/backup-data.mjs` must:

1. Read `DATABASE_PATH` (default `./data/laogong-caipu.sqlite`) and `BACKUP_ROOT` (default `./backups`).
2. Accept only `--kind daily|weekly|predeploy`.
3. Open the source read-only, run `db.backup(destination)` and close in `finally`.
4. Name database backups `<kind>-YYYY-MM-DDTHH-mm-ss-sssZ.sqlite`.
5. Retain newest 7 `daily-*`, newest 4 `weekly-*`, and newest 3 `predeploy-*` database files.
6. For `weekly`, copy `<dirname(DATABASE_PATH)>/generated` to `weekly-images-<timestamp>/` via `fs.cp(..., { recursive: true })` and retain newest 4 directories.
7. Use `BACKUP_NOW` only when `NODE_ENV=test`; production always uses the real current time.
8. Print only created paths and counts; never print environment values.

- [ ] **Step 5: Add Docker and Compose files**

Use Debian glibc so `better-sqlite3` and later `sharp` install prebuilt binaries:

```dockerfile
FROM node:20-bookworm-slim AS dev-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dev-deps AS builder
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json next.config.mjs ./
COPY scripts ./scripts
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Adapt the config filename to the repository's real `next.config.mjs`. Compose uses one service named `app`, `restart: unless-stopped`, `.env.production`, the two bind mounts, and loopback-only port publication. Do not bake `.env.production`, `data`, `backups`, `.next`, `node_modules` or user output into the image.

- [ ] **Step 6: Write the cloud deployment runbook**

`docs/deployment/cloud-server.md` must contain exact copy/paste sections for:

1. Creating `/srv/laogong-caipu/{app,data,backups}` with a dedicated system user.
2. Generating `FAMILY_PASSWORD_HASH` and a 32-byte base64 session secret without echoing them into shell history where possible.
3. Creating `.env.production` with `DATABASE_PATH=/app/data/laogong-caipu.sqlite` and existing AI variables.
4. `docker compose build`, `docker compose up -d`, health check and log commands.
5. A Caddy and an Nginx reverse-proxy example for HTTPS; both replace `recipes.example.com` with the user's real domain and proxy only to `127.0.0.1:3000`.
6. Daily/weekly cron commands, predeploy backup, upgrade, rollback and restore validation.
7. Explicit warning that a second app replica must not mount and write the same SQLite file.

Update README so cloud sharing is documented without claiming that a remote server has already been modified.

- [ ] **Step 7: Run deployment contract and commit**

Run:

```bash
npm run test -- tests/unit/deployment-contract.test.ts
```

Expected: PASS, including real temporary SQLite backup and seven-file retention.

Commit:

```bash
git add Dockerfile compose.yaml .dockerignore .env.example .gitignore package.json package-lock.json scripts/backup-data.mjs docs/deployment/cloud-server.md README.md tests/unit/deployment-contract.test.ts
git commit -m "feat: add persistent cloud deployment"
```

---

## Family Plan Completion Gate

After Tasks 1–5, run only:

```bash
npm run test -- tests/unit/family-auth.test.ts tests/unit/family-auth-routes.test.ts tests/unit/family-gate.test.ts tests/unit/family-auth-ui.test.tsx tests/unit/db-client.test.ts tests/unit/foreground-refresh.test.tsx tests/unit/recipe-list-v3.test.tsx tests/unit/recipe-detail-v3.test.tsx tests/unit/deployment-contract.test.ts
```

Expected: all listed files pass. Do not run the full suite, lint, build or Playwright here; those run once after the separate ingredient-image plan also passes.
