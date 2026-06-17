# 老公菜谱 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only mobile H5 Next.js app that imports Xiaohongshu share text, attempts to crawl the linked note, parses it into a structured recipe with DeepSeek or a mock parser, stores it in SQLite, and lets the user browse recipes and record cooking feedback.

**Architecture:** Use one Next.js full-stack app. Keep domain parsing, crawling, AI parsing, validation, database access, and route handlers in focused server-side modules; keep mobile UI in app routes and shared components. The import flow is a resilient pipeline: parse input, crawl when possible, parse with AI, validate, show editable confirmation, then persist.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Framer Motion, SQLite via better-sqlite3, Zod, Vitest, React Testing Library, Playwright, canvas-confetti.

## Global Constraints

- First version is local self-use only.
- No login, accounts, multi-user, or permission system.
- No public deployment, public security model, sharing permissions, or cloud database.
- Xiaohongshu is the primary source.
- Xiaohongshu crawling must not promise 100% success and must not implement complex login state, cookie management, or anti-bot bypassing.
- Crawling failures must not end the user flow; preserve share text and allow manual content supplementation.
- SQLite is the local database.
- DeepSeek is the default AI parser; API key and model name must come from `.env`.
- Mobile H5 is the primary experience; desktop only needs to remain basically usable.
- Visual style uses warm coral `#FF6B6B`, cream apricot `#FFE4D6`, cream white `#FFF9F5`, 16px cards, 24px buttons, soft diffuse shadows, title font weight 600, body font weight 400.
- React animation replaces the original Vue animation requirements: page fade/up transitions, staggered cards, bottom sheet slide, toast, skeleton pulse, and optional confetti on feedback submit.

---

## Planned File Structure

- `package.json` - scripts and dependencies.
- `next.config.ts` - Next.js config.
- `tsconfig.json` - strict TypeScript config with `@/*` path alias.
- `vitest.config.ts` - unit and component test config.
- `playwright.config.ts` - mobile E2E test config.
- `.env.example` - local configuration template.
- `src/app/layout.tsx` - root layout and metadata.
- `src/app/globals.css` - Tailwind theme tokens and base mobile styling.
- `src/app/page.tsx` - import page.
- `src/app/recipes/page.tsx` - recipe list page.
- `src/app/recipes/[id]/page.tsx` - recipe detail page.
- `src/app/categories/page.tsx` - lightweight category/tag filter page.
- `src/app/api/import/parse/route.ts` - parse imported share text without saving.
- `src/app/api/recipes/route.ts` - list recipes and save confirmed recipe.
- `src/app/api/recipes/[id]/route.ts` - recipe detail API.
- `src/app/api/recipes/[id]/cook/route.ts` - cooking log API.
- `src/components/*` - mobile UI components.
- `src/lib/domain/recipe.ts` - shared domain types and Zod schemas.
- `src/lib/source/source-parser.ts` - Xiaohongshu share text parsing.
- `src/lib/crawler/crawler.ts` - URL expansion and simple HTML extraction.
- `src/lib/ai/recipe-parser.ts` - AI parser interface, DeepSeek implementation, mock implementation, validation.
- `src/lib/db/schema.ts` - SQLite schema migration.
- `src/lib/db/client.ts` - SQLite connection.
- `src/lib/db/recipe-repository.ts` - recipe persistence.
- `src/lib/import/import-service.ts` - import orchestration.
- `src/lib/http/api-client.ts` - browser-side API client.
- `tests/unit/*` - unit tests.
- `tests/e2e/mobile-flow.spec.ts` - mobile user flow smoke test.

---

### Task 1: Scaffold Next.js App, Tooling, and Theme Foundation

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/setup.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/bottom-nav.tsx`
- Create: `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: Next.js app root, Tailwind theme tokens, scripts `dev`, `build`, `lint`, `test`, `test:e2e`.
- Produces: `AppShell({ children }: { children: React.ReactNode })`.

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "name": "laogong-caipu",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "better-sqlite3": "^11.9.1",
    "canvas-confetti": "^1.9.3",
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/canvas-confetti": "^1.9.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.0.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coral: "#FF6B6B",
        apricot: "#FFE4D6",
        cream: "#FFF9F5",
        ink: "#3D2F2F",
        muted: "#8A6F6A"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(61, 47, 47, 0.10)",
        lift: "0 12px 32px rgba(61, 47, 47, 0.14)"
      },
      borderRadius: {
        card: "16px",
        pill: "24px"
      }
    }
  },
  plugins: []
};

export default config;
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["iPhone 13"]
  }
});
```

Create `.env.example`:

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro
AI_PROVIDER=mock
DATABASE_PATH=./data/laogong-caipu.sqlite
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `.gitignore`:

```gitignore
.next
node_modules
.env
data
playwright-report
test-results
coverage
```

- [ ] **Step 2: Create root layout, theme CSS, and mobile shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "老公菜谱",
  description: "本地自用的小红书菜谱导入和做菜复盘工具"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: #3d2f2f;
  background: #fff9f5;
}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
  background: #fff9f5;
}

body {
  min-height: 100%;
  margin: 0;
  background: #fff9f5;
  color: #3d2f2f;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-weight: 400;
  letter-spacing: 0;
}

button,
input,
textarea {
  font: inherit;
}
```

Create `src/components/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FolderHeart, PlusCircle } from "lucide-react";

const items = [
  { href: "/", label: "导入", icon: PlusCircle },
  { href: "/recipes", label: "菜谱", icon: BookOpen },
  { href: "/categories", label: "分类", icon: FolderHeart }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-apricot/70 bg-cream/95 px-4 pb-4 pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-[430px] grid-cols-3 gap-2">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-pill px-3 py-2 text-xs transition ${
                active ? "bg-coral text-white shadow-soft" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

Create `src/components/app-shell.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-[430px] bg-cream px-4 pb-28 pt-5">
      {children}
      <BottomNav />
    </main>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";

export default function ImportPage() {
  return (
    <AppShell>
      <section className="space-y-4">
        <div>
          <p className="text-sm text-muted">小红书菜谱导入</p>
          <h1 className="text-2xl font-semibold text-ink">老公菜谱</h1>
        </div>
        <div className="rounded-card bg-white p-4 shadow-soft">
          <p className="text-sm text-muted">把小红书分享内容粘贴在这里，稍后会整理成可做菜的攻略。</p>
        </div>
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 3: Add smoke test**

Create `tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("tooling smoke test", () => {
  it("runs unit tests", () => {
    expect("老公菜谱").toContain("菜谱");
  });
});
```

- [ ] **Step 4: Install dependencies and verify**

Run:

```bash
npm install
npm run test
npm run build
```

Expected: unit test passes and Next.js build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts tests/setup.ts .env.example .gitignore src tests
git commit -m "chore: scaffold mobile Next app"
```

---

### Task 2: Add Domain Schemas and Xiaohongshu Source Parser

**Files:**
- Create: `src/lib/domain/recipe.ts`
- Create: `src/lib/source/source-parser.ts`
- Create: `tests/unit/source-parser.test.ts`
- Create: `tests/unit/recipe-schema.test.ts`

**Interfaces:**
- Produces: `RecipeDraftSchema`, `type RecipeDraft`, `type ImportInput`.
- Produces: `parseSourceInput(rawInput: string): ParsedSourceInput`.
- Produces: `ParsedSourceInput` with `{ sourcePlatform, sourceUrl, shareText, normalizedInput }`.

- [ ] **Step 1: Write failing tests for source parsing**

Create `tests/unit/source-parser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseSourceInput } from "@/lib/source/source-parser";

describe("parseSourceInput", () => {
  it("extracts Xiaohongshu short link and share text", () => {
    const input = "5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算... http://xhslink.com/o/smiaxnsR3c \n复制后打开【小红书】查看笔记！";

    const result = parseSourceInput(input);

    expect(result.sourcePlatform).toBe("xiaohongshu");
    expect(result.sourceUrl).toBe("http://xhslink.com/o/smiaxnsR3c");
    expect(result.shareText).toBe("5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算...");
    expect(result.normalizedInput).toContain("丝瓜炒蛋");
  });

  it("supports a generic URL when the platform is unknown", () => {
    const result = parseSourceInput("https://example.com/recipe");

    expect(result.sourcePlatform).toBe("unknown");
    expect(result.sourceUrl).toBe("https://example.com/recipe");
    expect(result.shareText).toBe("");
  });

  it("returns empty URL and preserved text when no URL exists", () => {
    const result = parseSourceInput("只有正文，没有链接");

    expect(result.sourcePlatform).toBe("manual");
    expect(result.sourceUrl).toBe("");
    expect(result.shareText).toBe("只有正文，没有链接");
  });
});
```

- [ ] **Step 2: Write failing tests for recipe schema**

Create `tests/unit/recipe-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RecipeDraftSchema } from "@/lib/domain/recipe";

describe("RecipeDraftSchema", () => {
  it("accepts a valid AI recipe draft", () => {
    const parsed = RecipeDraftSchema.parse({
      name: "丝瓜炒蛋",
      mainCategory: "家常菜",
      tags: ["下饭", "快手菜"],
      ingredients: [{ name: "丝瓜", amount: "1根", type: "ingredient" }],
      seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
      steps: [{ order: 1, text: "丝瓜去皮切块。" }],
      cookTimeMinutes: 5,
      difficulty: "easy",
      tips: "鸡蛋先炒熟盛出，最后回锅。",
      confidence: 0.82,
      missingFields: []
    });

    expect(parsed.name).toBe("丝瓜炒蛋");
  });

  it("rejects drafts without steps", () => {
    expect(() =>
      RecipeDraftSchema.parse({
        name: "丝瓜炒蛋",
        mainCategory: "家常菜",
        tags: [],
        ingredients: [],
        seasonings: [],
        steps: [],
        cookTimeMinutes: null,
        difficulty: "easy",
        tips: "",
        confidence: 0.6,
        missingFields: []
      })
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test -- tests/unit/source-parser.test.ts tests/unit/recipe-schema.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement domain schema**

Create `src/lib/domain/recipe.ts`:

```ts
import { z } from "zod";

export const IngredientTypeSchema = z.enum(["ingredient", "seasoning"]);

export const RecipeIngredientSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.string().trim().default(""),
  type: IngredientTypeSchema
});

export const RecipeStepSchema = z.object({
  order: z.number().int().positive(),
  text: z.string().trim().min(1),
  imageUrl: z.string().url().optional().nullable()
});

export const RecipeDraftSchema = z.object({
  name: z.string().trim().min(1),
  mainCategory: z.string().trim().default("未分类"),
  tags: z.array(z.string().trim().min(1)).default([]),
  ingredients: z.array(RecipeIngredientSchema).default([]),
  seasonings: z.array(RecipeIngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).min(1),
  cookTimeMinutes: z.number().int().positive().nullable().default(null),
  difficulty: z.enum(["easy", "medium", "hard", "unknown"]).default("unknown"),
  tips: z.string().trim().default(""),
  confidence: z.number().min(0).max(1).default(0.5),
  missingFields: z.array(z.string()).default([]),
  sourcePlatform: z.string().optional(),
  sourceUrl: z.string().optional(),
  originalTitle: z.string().optional(),
  shareText: z.string().optional(),
  coverImageUrl: z.string().url().optional().nullable()
});

export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;

export type ImportInput = {
  rawInput: string;
  manualSupplement?: string;
};
```

- [ ] **Step 5: Implement source parser**

Create `src/lib/source/source-parser.ts`:

```ts
export type SourcePlatform = "xiaohongshu" | "unknown" | "manual";

export type ParsedSourceInput = {
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  shareText: string;
  normalizedInput: string;
};

const URL_PATTERN = /https?:\/\/[^\s，。]+/i;
const XHS_PATTERN = /https?:\/\/xhslink\.com\/[^\s，。]+/i;

export function parseSourceInput(rawInput: string): ParsedSourceInput {
  const normalizedInput = rawInput.replace(/\r\n/g, "\n").trim();
  const xhsMatch = normalizedInput.match(XHS_PATTERN);
  const urlMatch = xhsMatch ?? normalizedInput.match(URL_PATTERN);
  const sourceUrl = urlMatch?.[0] ?? "";

  if (!sourceUrl) {
    return {
      sourcePlatform: "manual",
      sourceUrl: "",
      shareText: normalizedInput,
      normalizedInput
    };
  }

  const sourcePlatform: SourcePlatform = sourceUrl.includes("xhslink.com") ? "xiaohongshu" : "unknown";
  const beforeUrl = normalizedInput.slice(0, normalizedInput.indexOf(sourceUrl)).trim();
  const shareText = beforeUrl.replace(/复制后打开【小红书】查看笔记！/g, "").trim();

  return {
    sourcePlatform,
    sourceUrl,
    shareText,
    normalizedInput
  };
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm run test -- tests/unit/source-parser.test.ts tests/unit/recipe-schema.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/domain/recipe.ts src/lib/source/source-parser.ts tests/unit/source-parser.test.ts tests/unit/recipe-schema.test.ts
git commit -m "feat: parse recipe imports and validate drafts"
```

---

### Task 3: Add Crawler with Resilient Failure Results

**Files:**
- Create: `src/lib/crawler/crawler.ts`
- Create: `tests/unit/crawler.test.ts`

**Interfaces:**
- Consumes: `sourceUrl` from `parseSourceInput`.
- Produces: `crawlUrl(sourceUrl: string, fetcher?: typeof fetch): Promise<CrawlResult>`.
- `CrawlResult` is a discriminated union with `ok: true` or `ok: false`.

- [ ] **Step 1: Write failing crawler tests**

Create `tests/unit/crawler.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { crawlUrl } from "@/lib/crawler/crawler";

describe("crawlUrl", () => {
  it("extracts title, description, body text, and images from HTML", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>丝瓜炒蛋</title>
            <meta name="description" content="超级下饭的丝瓜炒蛋">
            <meta property="og:image" content="https://img.example.com/cover.jpg">
          </head>
          <body><main><p>丝瓜切块，鸡蛋炒熟。</p></main></body>
        </html>`,
        { status: 200, headers: { "content-type": "text/html" } }
      )
    );

    const result = await crawlUrl("https://example.com/recipe", fetcher as unknown as typeof fetch);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.title).toBe("丝瓜炒蛋");
      expect(result.description).toBe("超级下饭的丝瓜炒蛋");
      expect(result.text).toContain("丝瓜切块");
      expect(result.imageUrls).toEqual(["https://img.example.com/cover.jpg"]);
    }
  });

  it("returns a structured failure when the request fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await crawlUrl("https://example.com/fail", fetcher as unknown as typeof fetch);

    expect(result).toEqual({
      ok: false,
      errorCode: "network_error",
      errorMessage: "network down"
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- tests/unit/crawler.test.ts
```

Expected: FAIL because `src/lib/crawler/crawler.ts` does not exist.

- [ ] **Step 3: Implement crawler**

Create `src/lib/crawler/crawler.ts`:

```ts
export type CrawlFailureCode = "invalid_url" | "network_error" | "http_error" | "empty_content";

export type CrawlSuccess = {
  ok: true;
  finalUrl: string;
  title: string;
  description: string;
  text: string;
  imageUrls: string[];
  rawHtml: string;
};

export type CrawlFailure = {
  ok: false;
  errorCode: CrawlFailureCode;
  errorMessage: string;
};

export type CrawlResult = CrawlSuccess | CrawlFailure;

export async function crawlUrl(sourceUrl: string, fetcher: typeof fetch = fetch): Promise<CrawlResult> {
  if (!sourceUrl) {
    return { ok: false, errorCode: "invalid_url", errorMessage: "缺少可抓取的链接" };
  }

  try {
    const response = await fetcher(sourceUrl, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return { ok: false, errorCode: "http_error", errorMessage: `HTTP ${response.status}` };
    }

    const rawHtml = await response.text();
    const title = extractFirst(rawHtml, /<title[^>]*>(.*?)<\/title>/is);
    const description =
      extractMeta(rawHtml, "description") || extractMeta(rawHtml, "og:description") || "";
    const imageUrls = [...new Set([extractMeta(rawHtml, "og:image"), ...extractImages(rawHtml)].filter(Boolean))];
    const text = htmlToText(rawHtml);

    if (!title && !description && text.length < 20) {
      return { ok: false, errorCode: "empty_content", errorMessage: "页面内容为空或需要登录" };
    }

    return {
      ok: true,
      finalUrl: response.url || sourceUrl,
      title,
      description,
      text,
      imageUrls,
      rawHtml
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "network_error",
      errorMessage: error instanceof Error ? error.message : "网络请求失败"
    };
  }
}

function extractFirst(html: string, pattern: RegExp): string {
  return decodeHtml(html.match(pattern)?.[1]?.trim() ?? "");
}

function extractMeta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value.trim());
  }
  return "";
}

function extractImages(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter((src) => src.startsWith("http"));
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test -- tests/unit/crawler.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/crawler/crawler.ts tests/unit/crawler.test.ts
git commit -m "feat: add resilient crawler"
```

---

### Task 4: Add AI Recipe Parser with DeepSeek and Mock Providers

**Files:**
- Create: `src/lib/ai/recipe-parser.ts`
- Create: `tests/unit/recipe-parser.test.ts`

**Interfaces:**
- Consumes: `RecipeDraftSchema`.
- Produces: `parseRecipeFromContent(input: RecipeParserInput, provider?: AIRecipeParser): Promise<RecipeDraft>`.
- Produces: `createAIRecipeParserFromEnv(): AIRecipeParser`.

- [ ] **Step 1: Write failing AI parser tests**

Create `tests/unit/recipe-parser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockRecipeParser, parseRecipeFromContent } from "@/lib/ai/recipe-parser";

describe("parseRecipeFromContent", () => {
  it("returns a valid mock recipe draft", async () => {
    const draft = await parseRecipeFromContent(
      {
        sourcePlatform: "xiaohongshu",
        sourceUrl: "http://xhslink.com/o/smiaxnsR3c",
        shareText: "超级下饭的丝瓜炒蛋",
        crawledTitle: "",
        crawledText: "",
        crawledImageUrls: [],
        manualSupplement: ""
      },
      new MockRecipeParser()
    );

    expect(draft.name).toContain("丝瓜炒蛋");
    expect(draft.steps.length).toBeGreaterThan(0);
  });

  it("rejects invalid provider JSON", async () => {
    const badProvider = {
      parse: async () => ({
        name: "",
        mainCategory: "家常菜",
        tags: [],
        ingredients: [],
        seasonings: [],
        steps: [],
        cookTimeMinutes: null,
        difficulty: "easy",
        tips: "",
        confidence: 0.1,
        missingFields: []
      })
    };

    await expect(
      parseRecipeFromContent(
        {
          sourcePlatform: "manual",
          sourceUrl: "",
          shareText: "只有正文",
          crawledTitle: "",
          crawledText: "",
          crawledImageUrls: [],
          manualSupplement: ""
        },
        badProvider
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- tests/unit/recipe-parser.test.ts
```

Expected: FAIL because parser module does not exist.

- [ ] **Step 3: Implement AI parser**

Create `src/lib/ai/recipe-parser.ts`:

```ts
import { RecipeDraft, RecipeDraftSchema } from "@/lib/domain/recipe";

export type RecipeParserInput = {
  sourcePlatform: string;
  sourceUrl: string;
  shareText: string;
  crawledTitle: string;
  crawledText: string;
  crawledImageUrls: string[];
  manualSupplement: string;
};

export interface AIRecipeParser {
  parse(input: RecipeParserInput): Promise<unknown>;
}

export async function parseRecipeFromContent(
  input: RecipeParserInput,
  provider: AIRecipeParser = createAIRecipeParserFromEnv()
): Promise<RecipeDraft> {
  const result = await provider.parse(input);
  const parsed = RecipeDraftSchema.parse(result);
  return {
    ...parsed,
    sourcePlatform: input.sourcePlatform,
    sourceUrl: input.sourceUrl,
    originalTitle: input.crawledTitle,
    shareText: input.shareText,
    coverImageUrl: input.crawledImageUrls[0] ?? null
  };
}

export function createAIRecipeParserFromEnv(): AIRecipeParser {
  if (process.env.AI_PROVIDER === "deepseek") {
    return new DeepSeekRecipeParser({
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro"
    });
  }

  return new MockRecipeParser();
}

export class MockRecipeParser implements AIRecipeParser {
  async parse(input: RecipeParserInput): Promise<unknown> {
    const text = [input.shareText, input.crawledTitle, input.crawledText, input.manualSupplement].join("\n");
    const name = text.includes("丝瓜炒蛋") ? "丝瓜炒蛋" : "家常小炒";

    return {
      name,
      mainCategory: "家常菜",
      tags: ["下饭", "快手菜"],
      ingredients: [{ name: "主食材", amount: "适量", type: "ingredient" }],
      seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
      steps: [
        { order: 1, text: "处理并清洗食材。" },
        { order: 2, text: "热锅下油，按原文提示炒熟。" }
      ],
      cookTimeMinutes: text.includes("5分钟") ? 5 : null,
      difficulty: "easy",
      tips: "根据实际口味调整咸淡。",
      confidence: input.crawledText || input.manualSupplement ? 0.75 : 0.55,
      missingFields: input.crawledText || input.manualSupplement ? [] : ["原文步骤可能不完整"]
    };
  }
}

export class DeepSeekRecipeParser implements AIRecipeParser {
  constructor(private readonly config: { apiKey: string; model: string }) {}

  async parse(input: RecipeParserInput): Promise<unknown> {
    if (!this.config.apiKey) {
      throw new Error("缺少 DEEPSEEK_API_KEY");
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是菜谱结构化助手。只输出 JSON，不要输出 Markdown。字段必须包括 name, mainCategory, tags, ingredients, seasonings, steps, cookTimeMinutes, difficulty, tips, confidence, missingFields。difficulty 只能是 easy, medium, hard, unknown。"
          },
          {
            role: "user",
            content: buildPrompt(input)
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek 请求失败：HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    return JSON.parse(stripJsonFence(content));
  }
}

function buildPrompt(input: RecipeParserInput): string {
  return [
    `来源平台：${input.sourcePlatform}`,
    `来源链接：${input.sourceUrl}`,
    `分享文案：${input.shareText}`,
    `抓取标题：${input.crawledTitle}`,
    `抓取正文：${input.crawledText}`,
    `手动补充：${input.manualSupplement}`,
    `图片：${input.crawledImageUrls.join(", ")}`
  ].join("\n\n");
}

function stripJsonFence(content: string): string {
  return content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test -- tests/unit/recipe-parser.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/ai/recipe-parser.ts tests/unit/recipe-parser.test.ts
git commit -m "feat: add AI recipe parser"
```

---

### Task 5: Add SQLite Schema and Recipe Repository

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/recipe-repository.ts`
- Create: `tests/unit/recipe-repository.test.ts`

**Interfaces:**
- Consumes: `RecipeDraft`.
- Produces: `createRecipeRepository(db?: Database.Database): RecipeRepository`.
- Produces methods `saveRecipeDraft(draft)`, `listRecipes(filters?)`, `getRecipeById(id)`, `addCookingLog(id, input)`.

- [ ] **Step 1: Write failing repository tests**

Create `tests/unit/recipe-repository.test.ts`:

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/db/schema";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

describe("RecipeRepository", () => {
  it("saves a recipe draft and reads it with children", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createRecipeRepository(db);

    const saved = repo.saveRecipeDraft({
      name: "丝瓜炒蛋",
      mainCategory: "家常菜",
      tags: ["下饭"],
      ingredients: [{ name: "丝瓜", amount: "1根", type: "ingredient" }],
      seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
      steps: [{ order: 1, text: "丝瓜切块。" }],
      cookTimeMinutes: 5,
      difficulty: "easy",
      tips: "鸡蛋先炒熟。",
      confidence: 0.9,
      missingFields: [],
      sourcePlatform: "xiaohongshu",
      sourceUrl: "http://xhslink.com/o/smiaxnsR3c",
      originalTitle: "丝瓜炒蛋",
      shareText: "超级下饭",
      coverImageUrl: null
    });

    const recipe = repo.getRecipeById(saved.id);

    expect(recipe?.name).toBe("丝瓜炒蛋");
    expect(recipe?.ingredients[0]?.name).toBe("丝瓜");
    expect(recipe?.tags).toEqual(["下饭"]);
    expect(recipe?.steps[0]?.text).toBe("丝瓜切块。");
  });

  it("adds cooking logs and increments cooked count", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createRecipeRepository(db);

    const saved = repo.saveRecipeDraft({
      name: "家常小炒",
      mainCategory: "家常菜",
      tags: [],
      ingredients: [],
      seasonings: [],
      steps: [{ order: 1, text: "炒熟。" }],
      cookTimeMinutes: null,
      difficulty: "unknown",
      tips: "",
      confidence: 0.5,
      missingFields: []
    });

    repo.addCookingLog(saved.id, {
      wifeFeedback: "好吃",
      husbandImprovementNotes: "下次少放盐",
      notes: "火候可以"
    });

    const recipe = repo.getRecipeById(saved.id);
    expect(recipe?.cookedCount).toBe(1);
    expect(recipe?.cookingLogs[0]?.wifeFeedback).toBe("好吃");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- tests/unit/recipe-repository.test.ts
```

Expected: FAIL because database modules do not exist.

- [ ] **Step 3: Implement SQLite client and migration**

Create `src/lib/db/client.ts`:

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "@/lib/db/schema";

let singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (singleton) return singleton;

  const databasePath = process.env.DATABASE_PATH ?? "./data/laogong-caipu.sqlite";
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  singleton = new Database(databasePath);
  migrate(singleton);
  return singleton;
}
```

Create `src/lib/db/schema.ts`:

```ts
import type Database from "better-sqlite3";

export function migrate(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      main_category TEXT NOT NULL,
      source_platform TEXT,
      source_url TEXT,
      original_title TEXT,
      share_text TEXT,
      cover_image_url TEXT,
      cook_time_minutes INTEGER,
      difficulty TEXT NOT NULL DEFAULT 'unknown',
      tips TEXT NOT NULL DEFAULT '',
      cooked_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      text TEXT NOT NULL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cooking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      cooked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      wife_feedback TEXT NOT NULL DEFAULT '',
      husband_improvement_notes TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_input TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      share_text TEXT NOT NULL DEFAULT '',
      final_url TEXT,
      crawl_status TEXT NOT NULL,
      crawl_error TEXT,
      ai_status TEXT NOT NULL,
      ai_error TEXT,
      parsed_json TEXT,
      created_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
```

- [ ] **Step 4: Implement repository**

Create `src/lib/db/recipe-repository.ts`:

```ts
import type Database from "better-sqlite3";
import { RecipeDraft } from "@/lib/domain/recipe";
import { getDb } from "@/lib/db/client";

export type CookingLogInput = {
  wifeFeedback: string;
  husbandImprovementNotes: string;
  notes: string;
};

export type RecipeSummary = {
  id: number;
  name: string;
  mainCategory: string;
  coverImageUrl: string | null;
  cookedCount: number;
  tags: string[];
  latestWifeFeedback: string;
};

export type RecipeDetail = RecipeSummary & {
  sourcePlatform: string;
  sourceUrl: string;
  originalTitle: string;
  shareText: string;
  cookTimeMinutes: number | null;
  difficulty: string;
  tips: string;
  ingredients: Array<{ name: string; amount: string; type: string }>;
  seasonings: Array<{ name: string; amount: string; type: string }>;
  steps: Array<{ order: number; text: string; imageUrl: string | null }>;
  cookingLogs: Array<{
    id: number;
    cookedAt: string;
    wifeFeedback: string;
    husbandImprovementNotes: string;
    notes: string;
  }>;
};

export function createRecipeRepository(db: Database.Database = getDb()) {
  return {
    saveRecipeDraft(draft: RecipeDraft): { id: number } {
      const tx = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO recipes
             (name, main_category, source_platform, source_url, original_title, share_text, cover_image_url, cook_time_minutes, difficulty, tips)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            draft.name,
            draft.mainCategory,
            draft.sourcePlatform ?? "",
            draft.sourceUrl ?? "",
            draft.originalTitle ?? "",
            draft.shareText ?? "",
            draft.coverImageUrl ?? null,
            draft.cookTimeMinutes,
            draft.difficulty,
            draft.tips
          );

        const recipeId = Number(result.lastInsertRowid);
        const insertIngredient = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, name, amount, type, sort_order) VALUES (?, ?, ?, ?, ?)`
        );
        [...draft.ingredients, ...draft.seasonings].forEach((item, index) => {
          insertIngredient.run(recipeId, item.name, item.amount, item.type, index + 1);
        });

        const insertStep = db.prepare(
          `INSERT INTO recipe_steps (recipe_id, step_order, text, image_url) VALUES (?, ?, ?, ?)`
        );
        draft.steps.forEach((step) => insertStep.run(recipeId, step.order, step.text, step.imageUrl ?? null));

        const insertTag = db.prepare(`INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)`);
        draft.tags.forEach((tag) => insertTag.run(recipeId, tag));

        return { id: recipeId };
      });

      return tx();
    },

    listRecipes(filters: { query?: string; tag?: string; category?: string } = {}): RecipeSummary[] {
      const rows = db
        .prepare(
          `SELECT r.*, (
             SELECT wife_feedback FROM cooking_logs c WHERE c.recipe_id = r.id ORDER BY c.id DESC LIMIT 1
           ) AS latest_wife_feedback
           FROM recipes r
           WHERE (? = '' OR r.name LIKE ?)
             AND (? = '' OR r.main_category = ?)
           ORDER BY r.updated_at DESC, r.id DESC`
        )
        .all(filters.query ?? "", `%${filters.query ?? ""}%`, filters.category ?? "", filters.category ?? "") as any[];

      return rows
        .filter((row) => {
          if (!filters.tag) return true;
          const tags = getTags(db, row.id);
          return tags.includes(filters.tag);
        })
        .map((row) => ({
          id: row.id,
          name: row.name,
          mainCategory: row.main_category,
          coverImageUrl: row.cover_image_url,
          cookedCount: row.cooked_count,
          tags: getTags(db, row.id),
          latestWifeFeedback: row.latest_wife_feedback ?? ""
        }));
    },

    getRecipeById(id: number): RecipeDetail | null {
      const row = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(id) as any;
      if (!row) return null;

      const ingredients = getIngredients(db, id);
      return {
        id: row.id,
        name: row.name,
        mainCategory: row.main_category,
        coverImageUrl: row.cover_image_url,
        cookedCount: row.cooked_count,
        tags: getTags(db, id),
        latestWifeFeedback: "",
        sourcePlatform: row.source_platform ?? "",
        sourceUrl: row.source_url ?? "",
        originalTitle: row.original_title ?? "",
        shareText: row.share_text ?? "",
        cookTimeMinutes: row.cook_time_minutes,
        difficulty: row.difficulty,
        tips: row.tips,
        ingredients: ingredients.filter((item) => item.type === "ingredient"),
        seasonings: ingredients.filter((item) => item.type === "seasoning"),
        steps: getSteps(db, id),
        cookingLogs: getCookingLogs(db, id)
      };
    },

    addCookingLog(id: number, input: CookingLogInput): void {
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO cooking_logs (recipe_id, wife_feedback, husband_improvement_notes, notes) VALUES (?, ?, ?, ?)`
        ).run(id, input.wifeFeedback, input.husbandImprovementNotes, input.notes);
        db.prepare(`UPDATE recipes SET cooked_count = cooked_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      });
      tx();
    }
  };
}

function getTags(db: Database.Database, recipeId: number): string[] {
  return (db.prepare(`SELECT tag FROM recipe_tags WHERE recipe_id = ? ORDER BY id`).all(recipeId) as any[]).map(
    (row) => row.tag
  );
}

function getIngredients(db: Database.Database, recipeId: number) {
  return db
    .prepare(`SELECT name, amount, type FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order`)
    .all(recipeId) as Array<{ name: string; amount: string; type: string }>;
}

function getSteps(db: Database.Database, recipeId: number) {
  return (db
    .prepare(`SELECT step_order, text, image_url FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order`)
    .all(recipeId) as any[]).map((row) => ({
    order: row.step_order,
    text: row.text,
    imageUrl: row.image_url
  }));
}

function getCookingLogs(db: Database.Database, recipeId: number) {
  return (db
    .prepare(`SELECT id, cooked_at, wife_feedback, husband_improvement_notes, notes FROM cooking_logs WHERE recipe_id = ? ORDER BY id DESC`)
    .all(recipeId) as any[]).map((row) => ({
    id: row.id,
    cookedAt: row.cooked_at,
    wifeFeedback: row.wife_feedback,
    husbandImprovementNotes: row.husband_improvement_notes,
    notes: row.notes
  }));
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm run test -- tests/unit/recipe-repository.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/db/client.ts src/lib/db/schema.ts src/lib/db/recipe-repository.ts tests/unit/recipe-repository.test.ts
git commit -m "feat: persist recipes in sqlite"
```

---

### Task 6: Add Import Service and Import Parse API

**Files:**
- Create: `src/lib/import/import-service.ts`
- Create: `src/app/api/import/parse/route.ts`
- Create: `tests/unit/import-service.test.ts`

**Interfaces:**
- Consumes: `parseSourceInput`, `crawlUrl`, `parseRecipeFromContent`.
- Produces: `parseImport(input: ImportInput, deps?: ImportServiceDeps): Promise<ImportParseResult>`.
- API: `POST /api/import/parse` with `{ rawInput, manualSupplement? }`.

- [ ] **Step 1: Write failing import service tests**

Create `tests/unit/import-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseImport } from "@/lib/import/import-service";

describe("parseImport", () => {
  it("continues with share text when crawling fails", async () => {
    const result = await parseImport(
      {
        rawInput: "超级下饭的丝瓜炒蛋 http://xhslink.com/o/smiaxnsR3c 复制后打开【小红书】查看笔记！"
      },
      {
        crawlUrl: async () => ({ ok: false, errorCode: "empty_content", errorMessage: "页面内容为空" }),
        parseRecipeFromContent: async () => ({
          name: "丝瓜炒蛋",
          mainCategory: "家常菜",
          tags: ["下饭"],
          ingredients: [],
          seasonings: [],
          steps: [{ order: 1, text: "炒熟。" }],
          cookTimeMinutes: 5,
          difficulty: "easy",
          tips: "",
          confidence: 0.56,
          missingFields: ["原文步骤可能不完整"]
        })
      }
    );

    expect(result.source.sourcePlatform).toBe("xiaohongshu");
    expect(result.crawlStatus).toBe("failed");
    expect(result.recipe.name).toBe("丝瓜炒蛋");
    expect(result.needsSupplement).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- tests/unit/import-service.test.ts
```

Expected: FAIL because import service does not exist.

- [ ] **Step 3: Implement import service**

Create `src/lib/import/import-service.ts`:

```ts
import { parseRecipeFromContent as defaultParseRecipeFromContent } from "@/lib/ai/recipe-parser";
import { crawlUrl as defaultCrawlUrl, CrawlResult } from "@/lib/crawler/crawler";
import { ImportInput, RecipeDraft } from "@/lib/domain/recipe";
import { parseSourceInput, ParsedSourceInput } from "@/lib/source/source-parser";

export type ImportParseResult = {
  source: ParsedSourceInput;
  crawlStatus: "skipped" | "success" | "failed";
  crawlError: string;
  finalUrl: string;
  recipe: RecipeDraft;
  needsSupplement: boolean;
};

export type ImportServiceDeps = {
  crawlUrl?: (sourceUrl: string) => Promise<CrawlResult>;
  parseRecipeFromContent?: typeof defaultParseRecipeFromContent;
};

export async function parseImport(input: ImportInput, deps: ImportServiceDeps = {}): Promise<ImportParseResult> {
  const source = parseSourceInput(input.rawInput);
  const crawlUrl = deps.crawlUrl ?? defaultCrawlUrl;
  const parseRecipeFromContent = deps.parseRecipeFromContent ?? defaultParseRecipeFromContent;

  let crawlStatus: ImportParseResult["crawlStatus"] = source.sourceUrl ? "failed" : "skipped";
  let crawlError = "";
  let finalUrl = source.sourceUrl;
  let crawledTitle = "";
  let crawledText = "";
  let crawledImageUrls: string[] = [];

  if (source.sourceUrl) {
    const crawlResult = await crawlUrl(source.sourceUrl);
    if (crawlResult.ok) {
      crawlStatus = "success";
      finalUrl = crawlResult.finalUrl;
      crawledTitle = crawlResult.title;
      crawledText = [crawlResult.description, crawlResult.text].filter(Boolean).join("\n");
      crawledImageUrls = crawlResult.imageUrls;
    } else {
      crawlStatus = "failed";
      crawlError = crawlResult.errorMessage;
    }
  }

  const recipe = await parseRecipeFromContent({
    sourcePlatform: source.sourcePlatform,
    sourceUrl: source.sourceUrl,
    shareText: source.shareText,
    crawledTitle,
    crawledText,
    crawledImageUrls,
    manualSupplement: input.manualSupplement ?? ""
  });

  return {
    source,
    crawlStatus,
    crawlError,
    finalUrl,
    recipe,
    needsSupplement: recipe.confidence < 0.65 || recipe.missingFields.length > 0 || crawlStatus === "failed"
  };
}
```

- [ ] **Step 4: Implement API route**

Create `src/app/api/import/parse/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseImport } from "@/lib/import/import-service";

const RequestSchema = z.object({
  rawInput: z.string().trim().min(1),
  manualSupplement: z.string().optional().default("")
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const result = await parseImport(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "导入解析失败"
      },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm run test -- tests/unit/import-service.test.ts
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/import-service.ts src/app/api/import/parse/route.ts tests/unit/import-service.test.ts
git commit -m "feat: add import parsing API"
```

---

### Task 7: Add Recipe APIs for Save, List, Detail, and Cooking Logs

**Files:**
- Create: `src/app/api/recipes/route.ts`
- Create: `src/app/api/recipes/[id]/route.ts`
- Create: `src/app/api/recipes/[id]/cook/route.ts`
- Create: `tests/unit/recipe-api-shapes.test.ts`

**Interfaces:**
- Consumes: `RecipeDraftSchema`, `createRecipeRepository`.
- API: `GET /api/recipes?query=&category=&tag=`.
- API: `POST /api/recipes` with a recipe draft.
- API: `GET /api/recipes/:id`.
- API: `POST /api/recipes/:id/cook` with feedback fields.

- [ ] **Step 1: Write API shape test**

Create `tests/unit/recipe-api-shapes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

const CookingLogRequestSchema = z.object({
  wifeFeedback: z.string().trim().default(""),
  husbandImprovementNotes: z.string().trim().default(""),
  notes: z.string().trim().default("")
});

describe("recipe API request schemas", () => {
  it("accepts cooking log feedback fields", () => {
    const parsed = CookingLogRequestSchema.parse({
      wifeFeedback: "好吃",
      husbandImprovementNotes: "少放盐",
      notes: "下次多炒一会"
    });

    expect(parsed.husbandImprovementNotes).toBe("少放盐");
  });
});
```

- [ ] **Step 2: Implement recipes collection route**

Create `src/app/api/recipes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { RecipeDraftSchema } from "@/lib/domain/recipe";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repo = createRecipeRepository();
  const recipes = repo.listRecipes({
    query: url.searchParams.get("query") ?? "",
    category: url.searchParams.get("category") ?? "",
    tag: url.searchParams.get("tag") ?? ""
  });

  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  try {
    const draft = RecipeDraftSchema.parse(await request.json());
    const repo = createRecipeRepository();
    const saved = repo.saveRecipeDraft(draft);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存菜谱失败" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 3: Implement detail route**

Create `src/app/api/recipes/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repo = createRecipeRepository();
  const recipe = repo.getRecipeById(Number(id));

  if (!recipe) {
    return NextResponse.json({ error: "菜谱不存在" }, { status: 404 });
  }

  return NextResponse.json({ recipe });
}
```

- [ ] **Step 4: Implement cooking log route**

Create `src/app/api/recipes/[id]/cook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRecipeRepository } from "@/lib/db/recipe-repository";

const RequestSchema = z.object({
  wifeFeedback: z.string().trim().default(""),
  husbandImprovementNotes: z.string().trim().default(""),
  notes: z.string().trim().default("")
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = RequestSchema.parse(await request.json());
    const repo = createRecipeRepository();
    repo.addCookingLog(Number(id), body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "记录做过失败" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test -- tests/unit/recipe-api-shapes.test.ts tests/unit/recipe-repository.test.ts
npm run build
```

Expected: PASS and build succeeds.

Commit:

```bash
git add src/app/api/recipes tests/unit/recipe-api-shapes.test.ts
git commit -m "feat: add recipe APIs"
```

---

### Task 8: Build Shared Mobile UI Components and API Client

**Files:**
- Create: `src/lib/http/api-client.ts`
- Create: `src/components/page-transition.tsx`
- Create: `src/components/toast.tsx`
- Create: `src/components/bottom-sheet.tsx`
- Create: `src/components/recipe-card.tsx`
- Create: `src/components/skeleton-card.tsx`
- Create: `tests/unit/recipe-card.test.tsx`

**Interfaces:**
- Consumes: API response shapes from Tasks 6 and 7.
- Produces: `parseImportApi`, `saveRecipeApi`, `listRecipesApi`, `getRecipeApi`, `addCookingLogApi`.
- Produces reusable mobile UI primitives for later pages.

- [ ] **Step 1: Write component test**

Create `tests/unit/recipe-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeCard } from "@/components/recipe-card";

describe("RecipeCard", () => {
  it("renders recipe summary", () => {
    render(
      <RecipeCard
        recipe={{
          id: 1,
          name: "丝瓜炒蛋",
          mainCategory: "家常菜",
          coverImageUrl: null,
          cookedCount: 2,
          tags: ["下饭"],
          latestWifeFeedback: "好吃"
        }}
      />
    );

    expect(screen.getByText("丝瓜炒蛋")).toBeInTheDocument();
    expect(screen.getByText("做过 2 次")).toBeInTheDocument();
    expect(screen.getByText("好吃")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement API client**

Create `src/lib/http/api-client.ts`:

```ts
import { RecipeDraft } from "@/lib/domain/recipe";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "请求失败");
  }
  return payload as T;
}

export function parseImportApi(input: { rawInput: string; manualSupplement?: string }) {
  return requestJson<{ recipe: RecipeDraft; needsSupplement: boolean; crawlStatus: string; crawlError: string }>(
    "/api/import/parse",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function saveRecipeApi(recipe: RecipeDraft) {
  return requestJson<{ id: number }>("/api/recipes", { method: "POST", body: JSON.stringify(recipe) });
}

export function listRecipesApi(params: { query?: string; category?: string; tag?: string } = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return requestJson<{ recipes: any[] }>(`/api/recipes?${search.toString()}`);
}

export function getRecipeApi(id: number) {
  return requestJson<{ recipe: any }>(`/api/recipes/${id}`);
}

export function addCookingLogApi(id: number, input: { wifeFeedback: string; husbandImprovementNotes: string; notes: string }) {
  return requestJson<{ ok: true }>(`/api/recipes/${id}/cook`, { method: "POST", body: JSON.stringify(input) });
}
```

- [ ] **Step 3: Implement UI components**

Create `src/components/page-transition.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {children}
    </motion.div>
  );
}
```

Create `src/components/toast.tsx`:

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";

export function Toast({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed left-1/2 top-4 z-50 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 rounded-pill bg-coral px-4 py-3 text-center text-sm text-white shadow-lift"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
```

Create `src/components/bottom-sheet.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";

export function BottomSheet({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40">
          <button className="absolute inset-0 bg-ink/20" aria-label="关闭弹窗" onClick={onClose} />
          <motion.section
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[430px] rounded-t-[24px] bg-cream p-5 shadow-lift"
          >
            <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
            {children}
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
```

Create `src/components/recipe-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export type RecipeCardSummary = {
  id: number;
  name: string;
  mainCategory: string;
  coverImageUrl: string | null;
  cookedCount: number;
  tags: string[];
  latestWifeFeedback: string;
};

export function RecipeCard({ recipe, index = 0 }: { recipe: RecipeCardSummary; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={`/recipes/${recipe.id}`} className="block rounded-card bg-white p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
        <div className="flex gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-card bg-apricot">
            {recipe.coverImageUrl ? <img src={recipe.coverImageUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-ink">{recipe.name}</h3>
              <span className="shrink-0 rounded-pill bg-apricot px-2 py-1 text-xs text-ink">{recipe.mainCategory}</span>
            </div>
            <p className="mt-2 text-xs text-muted">做过 {recipe.cookedCount} 次</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-pill bg-cream px-2 py-1 text-xs text-muted">
                  {tag}
                </span>
              ))}
            </div>
            {recipe.latestWifeFeedback ? <p className="mt-2 line-clamp-1 text-sm text-coral">{recipe.latestWifeFeedback}</p> : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
```

Create `src/components/skeleton-card.tsx`:

```tsx
export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-card bg-white p-4 shadow-soft">
      <div className="flex gap-3">
        <div className="h-20 w-20 rounded-card bg-apricot/70" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-2/3 rounded bg-apricot/70" />
          <div className="h-3 w-1/3 rounded bg-apricot/60" />
          <div className="h-3 w-full rounded bg-apricot/50" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test -- tests/unit/recipe-card.test.tsx
npm run build
```

Expected: PASS and build succeeds.

Commit:

```bash
git add src/lib/http/api-client.ts src/components tests/unit/recipe-card.test.tsx
git commit -m "feat: add mobile UI primitives"
```

---

### Task 9: Build Import and Confirmation Flow UI

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/import-flow.tsx`
- Create: `src/components/recipe-confirm-form.tsx`

**Interfaces:**
- Consumes: `parseImportApi`, `saveRecipeApi`.
- Produces: mobile import flow with paste input, staged status, supplementation, editable confirmation, and save.

- [ ] **Step 1: Replace import page with client flow**

Modify `src/app/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { ImportFlow } from "@/components/import-flow";
import { PageTransition } from "@/components/page-transition";

export default function ImportPage() {
  return (
    <AppShell>
      <PageTransition>
        <ImportFlow />
      </PageTransition>
    </AppShell>
  );
}
```

- [ ] **Step 2: Create confirmation form**

Create `src/components/recipe-confirm-form.tsx`:

```tsx
"use client";

import { RecipeDraft } from "@/lib/domain/recipe";

export function RecipeConfirmForm({
  draft,
  onChange
}: {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
}) {
  const update = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm text-muted">菜名</span>
        <input className="mt-1 w-full rounded-card border border-apricot bg-white px-4 py-3" value={draft.name} onChange={(event) => update("name", event.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-muted">主分类</span>
        <input className="mt-1 w-full rounded-card border border-apricot bg-white px-4 py-3" value={draft.mainCategory} onChange={(event) => update("mainCategory", event.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-muted">标签，用空格分隔</span>
        <input className="mt-1 w-full rounded-card border border-apricot bg-white px-4 py-3" value={draft.tags.join(" ")} onChange={(event) => update("tags", event.target.value.split(/\s+/).filter(Boolean))} />
      </label>
      <section className="rounded-card bg-white p-4 shadow-soft">
        <h3 className="font-semibold">食材</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {[...draft.ingredients, ...draft.seasonings].map((item, index) => (
            <li key={`${item.name}-${index}`}>{item.name} {item.amount}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-card bg-white p-4 shadow-soft">
        <h3 className="font-semibold">步骤</h3>
        <ol className="mt-2 space-y-2 text-sm text-muted">
          {draft.steps.map((step) => (
            <li key={step.order}>{step.order}. {step.text}</li>
          ))}
        </ol>
      </section>
      <label className="block">
        <span className="text-sm text-muted">小贴士</span>
        <textarea className="mt-1 min-h-24 w-full rounded-card border border-apricot bg-white px-4 py-3" value={draft.tips} onChange={(event) => update("tips", event.target.value)} />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Create import flow**

Create `src/components/import-flow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeDraft } from "@/lib/domain/recipe";
import { parseImportApi, saveRecipeApi } from "@/lib/http/api-client";
import { RecipeConfirmForm } from "@/components/recipe-confirm-form";
import { Toast } from "@/components/toast";

const example = "5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算... http://xhslink.com/o/smiaxnsR3c 复制后打开【小红书】查看笔记！";

export function ImportFlow() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [manualSupplement, setManualSupplement] = useState("");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [status, setStatus] = useState("");
  const [needsSupplement, setNeedsSupplement] = useState(false);
  const [toast, setToast] = useState("");

  async function parse() {
    setStatus("正在识别链接");
    try {
      setStatus("正在抓取内容");
      const result = await parseImportApi({ rawInput, manualSupplement });
      setStatus("正在整理成菜谱");
      setDraft(result.recipe);
      setNeedsSupplement(result.needsSupplement);
      setStatus("");
    } catch (error) {
      setStatus("");
      setToast(error instanceof Error ? error.message : "解析失败");
    }
  }

  async function save() {
    if (!draft) return;
    const saved = await saveRecipeApi(draft);
    setToast("保存成功");
    window.setTimeout(() => router.push(`/recipes/${saved.id}`), 500);
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">小红书菜谱导入</p>
        <h1 className="text-2xl font-semibold text-ink">老公菜谱</h1>
      </div>

      {!draft ? (
        <div className="space-y-4">
          <textarea
            className="min-h-48 w-full rounded-card border border-apricot bg-white px-4 py-3 shadow-soft outline-none focus:border-coral"
            placeholder={example}
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
          />
          <button className="w-full rounded-pill bg-coral px-5 py-4 font-semibold text-white shadow-soft" onClick={parse} disabled={!rawInput || Boolean(status)}>
            {status || "开始抓取"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {needsSupplement ? (
            <div className="rounded-card bg-apricot p-4 text-sm text-ink">
              内容有点少，可以补充原文后重新解析。
              <textarea className="mt-3 min-h-28 w-full rounded-card border border-white bg-white px-4 py-3" value={manualSupplement} onChange={(event) => setManualSupplement(event.target.value)} />
              <button className="mt-3 rounded-pill bg-coral px-4 py-2 text-sm font-semibold text-white" onClick={parse}>重新解析</button>
            </div>
          ) : null}
          <RecipeConfirmForm draft={draft} onChange={setDraft} />
          <button className="w-full rounded-pill bg-coral px-5 py-4 font-semibold text-white shadow-soft" onClick={save}>
            保存菜谱
          </button>
        </div>
      )}

      <Toast message={toast} />
    </section>
  );
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run build
```

Expected: build succeeds.

Commit:

```bash
git add src/app/page.tsx src/components/import-flow.tsx src/components/recipe-confirm-form.tsx
git commit -m "feat: build recipe import flow"
```

---

### Task 10: Build Recipe List, Category, Detail, and Cooking Log UI

**Files:**
- Create: `src/app/recipes/page.tsx`
- Create: `src/app/recipes/[id]/page.tsx`
- Create: `src/app/categories/page.tsx`
- Create: `src/components/recipe-list.tsx`
- Create: `src/components/recipe-detail.tsx`
- Create: `src/components/cooking-log-sheet.tsx`

**Interfaces:**
- Consumes: recipe APIs and mobile UI components.
- Produces: browse, filter, detail, and mark-cooked flow.

- [ ] **Step 1: Create recipe list page and component**

Create `src/app/recipes/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeList } from "@/components/recipe-list";

export default function RecipesPage() {
  return (
    <AppShell>
      <PageTransition>
        <RecipeList />
      </PageTransition>
    </AppShell>
  );
}
```

Create `src/components/recipe-list.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listRecipesApi } from "@/lib/http/api-client";
import { RecipeCard, RecipeCardSummary } from "@/components/recipe-card";
import { SkeletonCard } from "@/components/skeleton-card";

export function RecipeList({ category, tag }: { category?: string; tag?: string }) {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeCardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listRecipesApi({ query, category, tag })
      .then((result) => setRecipes(result.recipes))
      .finally(() => setLoading(false));
  }, [query, category, tag]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm text-muted">已经收好的菜</p>
        <h1 className="text-2xl font-semibold text-ink">菜谱</h1>
      </div>
      <input
        className="w-full rounded-pill border border-apricot bg-white px-4 py-3 shadow-soft"
        placeholder="搜索菜名"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : recipes.length ? (
          recipes.map((recipe, index) => <RecipeCard key={recipe.id} recipe={recipe} index={index} />)
        ) : (
          <div className="rounded-card bg-white p-5 text-center text-sm text-muted shadow-soft">还没有菜谱</div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create category page**

Create `src/app/categories/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeList } from "@/components/recipe-list";

export default function CategoriesPage() {
  return (
    <AppShell>
      <PageTransition>
        <section className="space-y-4">
          <div>
            <p className="text-sm text-muted">按分类快速找菜</p>
            <h1 className="text-2xl font-semibold text-ink">分类</h1>
          </div>
          <RecipeList />
        </section>
      </PageTransition>
    </AppShell>
  );
}
```

- [ ] **Step 3: Create detail page and cooking sheet**

Create `src/app/recipes/[id]/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeDetail } from "@/components/recipe-detail";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <PageTransition>
        <RecipeDetail id={Number(id)} />
      </PageTransition>
    </AppShell>
  );
}
```

Create `src/components/cooking-log-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { BottomSheet } from "@/components/bottom-sheet";

export function CookingLogSheet({
  open,
  onClose,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { wifeFeedback: string; husbandImprovementNotes: string; notes: string }) => Promise<void>;
}) {
  const [wifeFeedback, setWifeFeedback] = useState("");
  const [husbandImprovementNotes, setHusbandImprovementNotes] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    await onSubmit({ wifeFeedback, husbandImprovementNotes, notes });
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    onClose();
  }

  return (
    <BottomSheet open={open} title="这次做得怎么样" onClose={onClose}>
      <div className="space-y-3">
        <textarea className="min-h-20 w-full rounded-card border border-apricot bg-white px-4 py-3" placeholder="老婆评价" value={wifeFeedback} onChange={(event) => setWifeFeedback(event.target.value)} />
        <textarea className="min-h-20 w-full rounded-card border border-apricot bg-white px-4 py-3" placeholder="老公下次改进事项" value={husbandImprovementNotes} onChange={(event) => setHusbandImprovementNotes(event.target.value)} />
        <textarea className="min-h-20 w-full rounded-card border border-apricot bg-white px-4 py-3" placeholder="我的备注" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <button className="w-full rounded-pill bg-coral px-5 py-4 font-semibold text-white shadow-soft" onClick={submit}>保存复盘</button>
      </div>
    </BottomSheet>
  );
}
```

Create `src/components/recipe-detail.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { addCookingLogApi, getRecipeApi } from "@/lib/http/api-client";
import { CookingLogSheet } from "@/components/cooking-log-sheet";
import { SkeletonCard } from "@/components/skeleton-card";
import { Toast } from "@/components/toast";

export function RecipeDetail({ id }: { id: number }) {
  const [recipe, setRecipe] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    const result = await getRecipeApi(id);
    setRecipe(result.recipe);
  }

  useEffect(() => {
    load();
  }, [id]);

  if (!recipe) return <SkeletonCard />;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">{recipe.mainCategory}</p>
        <h1 className="text-2xl font-semibold text-ink">{recipe.name}</h1>
        <p className="mt-1 text-sm text-muted">做过 {recipe.cookedCount} 次</p>
      </div>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="font-semibold">食材与调料</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {[...recipe.ingredients, ...recipe.seasonings].map((item: any, index: number) => (
            <li key={`${item.name}-${index}`}>{item.name} {item.amount}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="font-semibold">步骤</h2>
        <ol className="mt-3 space-y-3 text-sm text-muted">
          {recipe.steps.map((step: any) => (
            <li key={step.order}><span className="font-semibold text-coral">{step.order}.</span> {step.text}</li>
          ))}
        </ol>
      </section>

      {recipe.tips ? (
        <section className="rounded-card bg-apricot p-4 text-sm text-ink">
          <h2 className="font-semibold">小贴士</h2>
          <p className="mt-2">{recipe.tips}</p>
        </section>
      ) : null}

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="font-semibold">做过复盘</h2>
        <div className="mt-3 space-y-3">
          {recipe.cookingLogs.length ? recipe.cookingLogs.map((log: any) => (
            <div key={log.id} className="rounded-card bg-cream p-3 text-sm">
              <p className="text-coral">{log.wifeFeedback || "没有老婆评价"}</p>
              <p className="mt-1 text-muted">{log.husbandImprovementNotes || "没有改进事项"}</p>
            </div>
          )) : <p className="text-sm text-muted">还没记录做过。</p>}
        </div>
      </section>

      <button className="fixed bottom-24 left-1/2 z-20 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 rounded-pill bg-coral px-5 py-4 font-semibold text-white shadow-lift" onClick={() => setSheetOpen(true)}>
        标记做过
      </button>

      <CookingLogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={async (input) => {
          await addCookingLogApi(id, input);
          setToast("复盘保存成功");
          await load();
        }}
      />
      <Toast message={toast} />
    </section>
  );
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run build
```

Expected: build succeeds.

Commit:

```bash
git add src/app/recipes src/app/categories src/components/recipe-list.tsx src/components/recipe-detail.tsx src/components/cooking-log-sheet.tsx
git commit -m "feat: build recipe browsing flow"
```

---

### Task 11: Add Mobile E2E Smoke Test and Final Verification

**Files:**
- Create: `tests/e2e/mobile-flow.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed app.
- Produces: mobile smoke coverage and local run instructions.

- [ ] **Step 1: Add E2E smoke test**

Create `tests/e2e/mobile-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("mobile app renders import page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "老公菜谱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始抓取" })).toBeVisible();
});
```

- [ ] **Step 2: Add README**

Create or modify `README.md`:

```md
# 老公菜谱

本地自用的手机 H5 菜谱导入和做菜复盘工具。第一版支持粘贴小红书分享文本，后端尝试抓取内容，使用 DeepSeek 或 mock AI 解析成结构化菜谱，并保存到本地 SQLite。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

默认使用 mock AI：

```bash
AI_PROVIDER=mock
```

使用 DeepSeek 时配置：

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 key
DEEPSEEK_MODEL=deepseek-v4-pro
```

## 测试

```bash
npm run test
npm run build
npm run test:e2e
```

## 第一版边界

- 本地单人自用。
- SQLite 本地数据库。
- 小红书抓取失败时允许手动补充正文。
- 不做登录、多用户、公网部署或复杂反爬。
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test
npm run build
npm run test:e2e
```

Expected: all commands pass.

- [ ] **Step 4: Start local dev server for user trial**

Run:

```bash
npm run dev
```

Expected: app available at `http://localhost:3000`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/mobile-flow.spec.ts README.md
git commit -m "test: add mobile smoke coverage"
```

---

## Self-Review

- Spec coverage: Tasks cover local Next.js app setup, mobile UI, Xiaohongshu share parsing, crawler fallback behavior, DeepSeek/mock AI parsing, SQLite persistence, import API, recipe APIs, list/detail/cooking log UI, and final verification.
- Scope control: The plan excludes login, public deployment, multi-user permissions, cloud database, complex anti-bot bypassing, and full desktop adaptation.
- Type consistency: `RecipeDraft`, `parseSourceInput`, `crawlUrl`, `parseRecipeFromContent`, `parseImport`, and repository method names are used consistently across tasks.
- Implementation risk: Category page is intentionally lightweight and reuses `RecipeList`; richer category management remains outside this MVP.
