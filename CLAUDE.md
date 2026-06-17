# 老公菜谱 v0.1

本地自用的手机 H5 菜谱导入和做菜复盘工具。Next.js 14 + React 18 + TypeScript + SQLite + DeepSeek AI。

## 启动
```bash
nvm use v19.8.1   # Node >=18.17 即可
cp .env.example .env  # 默认 AI_PROVIDER=mock，改成 deepseek 需填 DEEPSEEK_API_KEY
npm run dev        # http://localhost:3000
npm run test       # 9 files / 15 tests (vitest)
npm run test:e2e   # Playwright
```

## 关键依赖
- better-sqlite3@9 (v11 在 macOS 12 上编译会失败)
- framer-motion, zod, canvas-confetti, lucide-react

## 目录结构
- `src/lib/domain/recipe.ts` — Zod schema + 类型 (RecipeDraft, ImportInput)
- `src/lib/source/source-parser.ts` — 小红书分享文本解析 (提取 xhslink.com 短链)
- `src/lib/crawler/crawler.ts` — 短链展开 + HTML 提取
- `src/lib/ai/recipe-parser.ts` — DeepSeek/Mock AI 解析器 + normalizeAIDraft (清洗标签/推断食材用量/分类)
- `src/lib/db/schema.ts` + `client.ts` + `recipe-repository.ts` — SQLite, CASCADE 外键
- `src/lib/import/import-service.ts` — 导入流水线编排，返回 ImportParseResult (含 imageUrls)
- `src/lib/http/api-client.ts` — 浏览器端 fetch 封装，含 filterImages/saveRecipeWithImages/deleteRecipeApi
- `src/components/` — 14 个组件 (玻璃拟态 UI)
- `src/app/` — Next.js App Router: 首页(/), 菜谱列表(/recipes), 详情(/recipes/[id]), 分类(/categories)

## API 路由
- `POST /api/import/parse` — 解析导入 (接收 rawInput, 返回 recipe + imageUrls)
- `POST /api/images/filter` — AI 筛选图片 (过滤表情包/头像/推广图)
- `GET|POST /api/recipes` — 列表(支持 query/category/tag/difficulty) / 保存
- `GET|DELETE /api/recipes/[id]` — 详情 / 删除
- `POST /api/recipes/[id]/cook` — 标记做过 (wifeRating/wifeFeedback/husbandImprovementNotes)

## 数据库要点
- DATABASE_PATH=./data/laogong-caipu.sqlite (delete to reset)
- cooking_logs 有 wife_rating 字段 (0-5)，INSERT 时用 DEFAULT 0
- recipe_images 存多图，recipe-repository 自动保存 imageUrls
- 删除菜谱 CASCADE 删除关联数据

## UI 规范
- 粉色暖色调: coral=#FF6B6B, cream=#FFF9F5, ink=#3D2F2F
- 毛玻璃: .glass-card (白底85%透明 + blur(20px)), .glass-nav, .glass-sheet, .glass-dialog, .btn-primary (coral 80%透明), .btn-ghost
- 手机优先 max-w-[430px], 底部导航 2 栏 (导入/菜谱)
- 菜谱列表长按进入删除模式, 菜谱详情滑动到底部才显示"标记做过"按钮
- Toast 2秒自动消失
- 图片轮播支持点击放大, AI筛选后可审核删除

## Node/系统兼容
- 系统 Node 18.15 只够跑 dev; 用 nvm 切换 v19.8.1 跑 build
- better-sqlite3 需要系统 Node 18 编译安装, Node 19 运行时会报 NODE_MODULE_VERSION 不匹配
- 如果重新 npm install 后 better-sqlite3 没法用, 先 `rm -rf node_modules && npm install` 用系统 Node 重装
