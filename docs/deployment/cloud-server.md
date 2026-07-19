# 单实例云服务器部署手册

本手册提供可复制的 Docker Compose 部署、HTTPS 反向代理、备份、升级、回滚和恢复命令。它只是部署契约，**不表示任何服务器已经被修改**。

> 安全前置条件：当前锁文件中的 Next.js 版本是 14.2.35；按照官方 support policy，14.x 已是 **unsupported**。实际公网部署前应另开迁移任务升级至受支持 LTS 并重新完成回归验证；本任务不自动升级框架，也不声称当前版本仍获安全维护。在完成升级前，只应在受控环境验证这套部署配置。

## 1. 准备专用用户和持久化目录

以下命令固定宿主机和镜像内 UID/GID 为 `10001`，使非 root 容器能写入绑定挂载。先把仓库 URL 换成真实地址：

```bash
sudo groupadd --system --gid 10001 laogong-caipu
sudo useradd --system --uid 10001 --gid 10001 --home-dir /srv/laogong-caipu --shell /usr/sbin/nologin laogong-caipu
sudo install -d -o 10001 -g 10001 -m 0750 /srv/laogong-caipu
sudo install -d -o 10001 -g 10001 -m 0750 /srv/laogong-caipu/app /srv/laogong-caipu/data /srv/laogong-caipu/backups
sudo -u laogong-caipu git clone REPLACE_WITH_REPOSITORY_URL /srv/laogong-caipu/app
sudo chown -R 10001:10001 /srv/laogong-caipu/app /srv/laogong-caipu/data /srv/laogong-caipu/backups
sudo -u laogong-caipu ln -s ../data /srv/laogong-caipu/app/data
sudo -u laogong-caipu ln -s ../backups /srv/laogong-caipu/app/backups
```

若 `/srv/laogong-caipu/app` 已由安全的发布流程放入代码，跳过 `git clone`，保留目录 ownership 和两个符号链接命令；如果链接已经存在，也跳过对应的 `ln -s`。这两个链接让 Compose 契约中的 `./data` 和 `./backups` 指向仓库外的持久化兄弟目录。不要把 `laogong-caipu` 用户加入 `docker` 组；该组通常等价于宿主机 root 权限，以下 Docker 管理命令都通过 `sudo` 执行。

## 2. 安全创建 mode-600 生产环境文件

密码摘要包含 `$`。Compose 会插值未加保护的 `$`，因此写入 `.env.production` 时必须为摘要值加**单引号**。下面的命令把密码交给交互式无回显脚本，把摘要和随机会话密钥留在临时 shell 变量中；命令历史里不会出现明文密码、摘要、API key 或会话密钥。

```bash
sudo -i
cd /srv/laogong-caipu/app
FAMILY_PASSWORD_HASH="$(sudo -u laogong-caipu npm run --silent auth:hash)"
FAMILY_SESSION_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
read -rsp "DeepSeek API key（mock 模式可直接回车）: " DEEPSEEK_API_KEY
printf '\n'
read -rsp "Micu API key（不生成食材图可直接回车）: " MICU_API_KEY
printf '\n'
case "$DEEPSEEK_API_KEY$MICU_API_KEY" in *"'"*) printf '%s\n' 'API key contains an unsupported quote' >&2; exit 1;; esac
umask 077
{
  printf "AI_PROVIDER='%s'\n" "deepseek"
  printf "DEEPSEEK_API_KEY='%s'\n" "$DEEPSEEK_API_KEY"
  printf "DEEPSEEK_MODEL='%s'\n" "deepseek-v4-pro"
  printf "MICU_API_KEY='%s'\n" "$MICU_API_KEY"
  printf "FAMILY_PASSWORD_HASH='%s'\n" "$FAMILY_PASSWORD_HASH"
  printf "FAMILY_SESSION_SECRET='%s'\n" "$FAMILY_SESSION_SECRET"
  printf "DATABASE_PATH=/app/data/laogong-caipu.sqlite\n"
  printf "BACKUP_ROOT=/app/backups\n"
} > .env.production
chmod 600 .env.production
chown 10001:10001 .env.production
unset FAMILY_PASSWORD_HASH FAMILY_SESSION_SECRET DEEPSEEK_API_KEY MICU_API_KEY
exit
```

使用 mock AI 时，把上面固定的 `deepseek` 改为 `mock`，API key 保持空值。不要运行 `cat .env.production`、`env`、`docker compose config` 或带 shell tracing 的 `set -x` 来检查配置，因为这些操作可能打印秘密。可只检查权限：

```bash
sudo stat -c '%a %u:%g %n' /srv/laogong-caipu/app/.env.production
```

期望 mode 为 `600`，owner 为 `10001:10001`。

## 3. 构建、启动和健康检查

Compose 只定义一个 `app` 服务，Next.js 在容器内监听 `0.0.0.0:3000`，宿主机只发布 `127.0.0.1:3000`。生产入口是 `next build` 后的 `next start`，不是开发服务器。

```bash
cd /srv/laogong-caipu/app
sudo docker compose build
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
sudo docker compose ps
sudo docker compose logs --tail 100 app
```

不要在防火墙开放容器端口，也不要把端口映射改为 `0.0.0.0`。Next.js 只能经 loopback 上的受信反向代理访问，不能直接连接公网。

Hermes 可以与本应用共存。如果 Hermes 或其他服务已占用宿主机 `3000`，只改宿主机端口和代理目标：把 `compose.yaml` 的宿主机侧改为例如 `127.0.0.1:3100:3000`，同时把下方代理目标改为 `127.0.0.1:3100`；不要改容器端口、持久化路径或新增副本。可先检查占用：

```bash
sudo ss -ltnp | grep -E ':(3000|3100)[[:space:]]'
```

## 4. HTTPS 反向代理（二选一）

先把所有 `recipes.example.com` 换成真实域名。两套示例都会保留外部 Host/HTTPS 协议，以可信连接的远端地址**覆盖** `X-Forwarded-For`，不会接受或追加客户端伪造的转发链；同时删除外部 `x-middleware-subrequest`。不要同时启用两套代理。

### Caddy

把站点块合并到现有 `/etc/caddy/Caddyfile`；若 Hermes 已由 Caddy 代理，保留它原有的独立站点块。全局 `servers` 选项只能出现一次，应与现有全局块合并。

```caddyfile
{
  servers {
    max_header_size 16KB
    timeouts {
      read_body 30s
      read_header 10s
      write 60s
      idle 2m
    }
  }
}

recipes.example.com {
  request_body {
    max_size 10MB
  }

  header {
    X-Content-Type-Options nosniff
    X-Frame-Options DENY
    Referrer-Policy strict-origin-when-cross-origin
  }

  reverse_proxy 127.0.0.1:3000 {
    header_up Host {http.request.host}
    header_up X-Forwarded-Proto https
    header_up X-Forwarded-For {http.request.remote.host}
    header_up X-Real-IP {http.request.remote.host}
    header_up -x-middleware-subrequest
    transport http {
      dial_timeout 5s
      response_header_timeout 60s
    }
  }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl --fail --silent --show-error https://recipes.example.com/api/health
```

### Nginx

证书路径由 Certbot 或现有证书管理流程提供。这里没有随意加入 HSTS、宽松 CORS 或未经应用验证的 CSP。

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name recipes.example.com;
    return 308 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name recipes.example.com;

    ssl_certificate /etc/letsencrypt/live/recipes.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/recipes.example.com/privkey.pem;

    client_max_body_size 10m;
    client_body_timeout 30s;
    client_header_timeout 10s;
    send_timeout 60s;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header x-middleware-subrequest "";
        proxy_set_header Connection "";
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
curl --fail --silent --show-error https://recipes.example.com/api/health
```

## 5. 自动备份和保留策略

online backup 使用 SQLite backup API，可在应用运行时执行。数据库每日保留 7 份、每周保留 4 份、发布前保留 3 份；每周还复制 `data/generated`，图片快照保留 4 份。尚未生成图片时，每周数据库备份仍成功，图片快照数量为 0。成功输出只有创建路径和保留数量，不包含环境值。

先手动验证三种命令：

```bash
cd /srv/laogong-caipu/app
sudo docker compose run --rm --no-deps app npm run backup -- --kind daily
sudo docker compose run --rm --no-deps app npm run backup -- --kind weekly
sudo docker compose run --rm --no-deps app npm run backup -- --kind predeploy
sudo find backups -maxdepth 1 -mindepth 1 -printf '%f\n' | sort
```

安装每日和每周 cron。cron 以 root 调 Docker，但备份文件由镜像内固定 UID `10001` 创建：

```bash
sudo tee /etc/cron.d/laogong-caipu-backup >/dev/null <<'CRON'
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root cd /srv/laogong-caipu/app && /usr/bin/docker compose run --rm --no-deps app npm run backup -- --kind daily
45 3 * * 0 root cd /srv/laogong-caipu/app && /usr/bin/docker compose run --rm --no-deps app npm run backup -- --kind weekly
CRON
sudo chmod 0644 /etc/cron.d/laogong-caipu-backup
```

## 6. 发布升级与回滚

每次升级先在线创建 `predeploy` 备份，再记录旧提交。把 `main` 换成实际发布分支：

```bash
cd /srv/laogong-caipu/app
sudo docker compose run --rm --no-deps app npm run backup -- --kind predeploy
sudo -u laogong-caipu git rev-parse HEAD | sudo tee /srv/laogong-caipu/previous-release >/dev/null
sudo -u laogong-caipu git fetch --prune origin
sudo -u laogong-caipu git switch main
sudo -u laogong-caipu git pull --ff-only origin main
sudo docker compose build
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

应用版本回滚不会自动回滚数据。先回到记录的提交并重建；只有在新版本确实执行了不兼容的数据迁移时，才按下一节恢复已验证的数据库备份：

```bash
cd /srv/laogong-caipu/app
PREVIOUS_REV="$(sudo cat /srv/laogong-caipu/previous-release)"
sudo -u laogong-caipu git switch --detach "$PREVIOUS_REV"
unset PREVIOUS_REV
sudo docker compose build
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

## 7. 完整性验证与恢复

先从 `backups/` 选择一个**文件名**，不要输入路径。下面的 allowlist 检查拒绝空值、斜杠和 `..`，然后在临时容器中以只读方式执行 `PRAGMA integrity_check`；只有输出 `integrity_check=ok` 才继续。

```bash
cd /srv/laogong-caipu/app
BACKUP_FILE=predeploy-REPLACE_WITH_TIMESTAMP.sqlite
case "$BACKUP_FILE" in ""|*/*|*..*) printf '%s\n' 'backup filename rejected' >&2; exit 1;; esac
test -f "backups/$BACKUP_FILE"
sudo docker compose run --rm --no-deps app node -e 'const Database=require("better-sqlite3"); const db=new Database(process.argv[1],{readonly:true,fileMustExist:true}); try { const rows=db.pragma("integrity_check"); if(rows.length!==1||rows[0].integrity_check!=="ok") process.exitCode=1; else console.log("integrity_check=ok"); } finally { db.close(); }' "/app/backups/$BACKUP_FILE"
```

验证通过后，先为当前数据再做一次 online backup，停止唯一 app 实例，原子替换主库并清理旧 WAL/SHM，再启动和复验：

```bash
sudo docker compose run --rm --no-deps app npm run backup -- --kind predeploy
sudo docker compose stop app
sudo install -o 10001 -g 10001 -m 0600 "backups/$BACKUP_FILE" data/.restore-laogong-caipu.sqlite
sudo mv data/.restore-laogong-caipu.sqlite data/laogong-caipu.sqlite
sudo rm -f data/laogong-caipu.sqlite-wal data/laogong-caipu.sqlite-shm
sudo docker compose up -d app
sudo docker compose exec app node -e 'const Database=require("better-sqlite3"); const db=new Database(process.env.DATABASE_PATH,{readonly:true,fileMustExist:true}); try { const rows=db.pragma("integrity_check"); if(rows.length!==1||rows[0].integrity_check!=="ok") process.exitCode=1; else console.log("integrity_check=ok"); } finally { db.close(); }'
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
unset BACKUP_FILE
```

如需恢复每周图片快照，先停 app，确认变量只含单个目录名，再同步并恢复 ownership：

```bash
IMAGE_BACKUP=weekly-images-REPLACE_WITH_TIMESTAMP
case "$IMAGE_BACKUP" in ""|*/*|*..*) printf '%s\n' 'image backup name rejected' >&2; exit 1;; esac
test -d "backups/$IMAGE_BACKUP"
sudo docker compose stop app
sudo install -d -o 10001 -g 10001 -m 0750 data/generated
sudo rsync -a --delete "backups/$IMAGE_BACKUP/" data/generated/
sudo chown -R 10001:10001 data/generated
sudo docker compose up -d app
unset IMAGE_BACKUP
```

## 单实例强制边界

**禁止启动第二个 app 实例挂载并写入同一个 SQLite 文件，也不要执行 `docker compose up --scale app=2`。** SQLite WAL 能改善同一实例中的并发，但不能把共享 bind mount 变成多副本数据库。需要横向扩容时，应先迁移到支持多实例的数据库并设计迁移与回滚方案。
