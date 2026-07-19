# 老公菜谱

手机优先的家庭共享 H5 菜谱导入和做菜复盘工具。它支持粘贴小红书分享文本，由服务端尝试抓取内容，使用 DeepSeek 或 mock AI 解析成结构化菜谱，并保存到单实例 SQLite。家庭密码门禁可让两台手机共享菜谱、收藏、做菜次数、复盘和已生成食材图。

## 界面预览

手机优先的 H5 界面，主要流程是粘贴小红书分享文本、查看已保存菜谱、进入详情复盘做菜结果。

<p>
  <img src="./output/playwright/home.png" alt="导入页：粘贴小红书分享文本并开始抓取" width="260">
  <img src="./output/playwright/recipes.png" alt="菜谱页：查看已保存菜谱列表" width="260">
  <img src="./output/playwright/recipe-detail-7.png" alt="详情页：查看食材步骤和做菜复盘" width="260">
</p>

- 导入页：粘贴小红书分享文本，一键抓取并解析成菜谱草稿。
- 菜谱页：按手机卡片浏览已保存菜谱，快速看到分类、标签和做过次数。
- 详情页：查看图片、食材、步骤和复盘记录，滑到底部可标记做过。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

`.env.example` 只列变量名，不带任何真实值。至少设置数据库、家庭密码摘要和 32 字节以上的会话密钥；密码摘要由交互式命令生成，不要保存明文密码：

```bash
npm run auth:hash
openssl rand -base64 32
```

本地使用 mock AI 时配置：

```bash
AI_PROVIDER=mock
DATABASE_PATH=./data/laogong-caipu.sqlite
```

使用 DeepSeek 时配置：

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 key
DEEPSEEK_MODEL=deepseek-v4-pro
```

食材图片服务按需配置 `MICU_API_KEY`。所有 key、家庭密码摘要和会话密钥都只放在未提交的 `.env` 或 `.env.production` 中。

## 家庭云共享

仓库包含单实例 Docker Compose、持久化 `data/` 与 `backups/` bind mount、SQLite online backup 和 HTTPS 反向代理契约。完整的目录 ownership、mode-600 环境文件、Caddy/Nginx、cron、升级、回滚和恢复命令见 [云服务器部署手册](./docs/deployment/cloud-server.md)。这些文件不会自动修改任何远程服务器。

当前原始部署契约仍锁定 `>=20.9 <21`，但 Node.js 20 已于 2026-03-24 EOL；Next.js 14.2.35 也已被官方 support policy 标记为 unsupported，现有 dependency audit findings 尚未处置。这三项明确阻断实际公网部署。后续必须另开迁移任务升级至受支持的 Node.js 22 或 24 与 Next.js LTS，验证 `better-sqlite3`、`sharp` 等 native dependencies 并完成回归和镜像测试；本任务没有擅自升级运行时或框架。

## 测试

```bash
npm run test
npm run build
npm run test:e2e
```

## 使用边界

- 一个家庭共享密码，不提供多用户、成员身份或角色权限。
- 单实例 SQLite；禁止多个 app 副本同时写同一个数据库文件。
- 服务端共享菜谱数据；计时器、语音、备料勾选和导入草稿仍留在当前手机。
- 小红书抓取失败时允许手动补充正文。
- 不提供复杂反爬或自动化服务器管理。
