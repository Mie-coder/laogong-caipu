# 单实例云服务器部署手册

本手册提供可复制的 Docker Compose 部署、HTTPS 反向代理、备份、升级、回滚和恢复命令。它只是部署契约，**不表示任何服务器已经被修改**。

> 公网阻断条件：当前锁文件中的 Next.js 版本是 14.2.35，按照官方 support policy，14.x 已是 **unsupported**；部署契约锁定的 Node.js 20 也已在 2026-03-24 EOL；`npm install --package-lock-only` 还报告了未处置的 dependency audit findings。三项都必须在实际公网部署前解决：另开迁移任务升级到仍受支持的 Node.js 22 或 Node.js 24 与受支持 LTS 版 Next.js，验证 `better-sqlite3`、`sharp` 等 native dependencies，重新完成回归与镜像验证。本任务遵守原契约，不擅自升级 Node 或框架，也不声称它们仍获安全维护。在迁移完成前，只能在受控、非公网环境验证本手册。

## 1. 准备专用用户和持久化目录

以下命令固定宿主机和镜像内 UID/GID 为 `10001`，使非 root 容器能写入绑定挂载。先把仓库 URL 换成真实地址：

```bash
sudo groupadd --system --gid 10001 laogong-caipu
sudo useradd --system --uid 10001 --gid 10001 --home-dir /srv/laogong-caipu --shell /usr/sbin/nologin laogong-caipu
sudo install -d -o root -g root -m 0755 /srv/laogong-caipu
sudo install -d -o root -g root -m 0755 /srv/laogong-caipu/app
sudo install -d -o 10001 -g 10001 -m 0750 /srv/laogong-caipu/data /srv/laogong-caipu/backups
sudo git clone REPLACE_WITH_REPOSITORY_URL /srv/laogong-caipu/app
sudo chown -R root:root /srv/laogong-caipu/app
sudo ln -s ../data /srv/laogong-caipu/app/data
sudo ln -s ../backups /srv/laogong-caipu/app/backups
```

若 `/srv/laogong-caipu/app` 已由受信发布流程放入代码，跳过 `git clone`，保留 root ownership 和两个符号链接命令；如果链接已经存在，也跳过对应的 `ln -s`。这两个链接让 Compose 契约中的 `./data` 和 `./backups` 指向仓库外的持久化兄弟目录。代码、Compose 和 mode-600 env 都由 root 控制；固定 UID `10001` 只拥有容器必须写入的 data/backups。不要把 `laogong-caipu` 用户加入 `docker` 组，该组通常等价于宿主机 root 权限。

## 2. 安全创建 mode-600 生产环境文件

纯 Docker 服务器不应为了生成摘要安装 host Node/npm。先在**可信开发机**的受信仓库 checkout 中运行现有交互 CLI；它会从 TTY 无回显读取家庭密码。将 stdout 直接送入受信剪贴板或密码管理器，不要把摘要写进聊天、shell history、日志或截图：

```bash
# macOS；先确认 pbcopy 属于受信系统工具
set -o pipefail
npm run --silent auth:hash | pbcopy

# Linux Wayland 可用受信 wl-copy 执行等价操作
# npm run --silent auth:hash | wl-copy
```

摘要包含 `$`，写入 Compose env 时必须用单引号避免插值。服务器只需要 Bash、OpenSSL 与 Docker；下面的 root Bash fail-fast 脚本通过 `/dev/tty` hidden `read -rsp` 接收粘贴的摘要与 API keys，不调用 host Node/npm。它严格要求 canonical `scrypt$<22-char-base64url>$<86-char-base64url>`，对 salt/digest 做 base64url round-trip 和 16/64-byte 检查，并验证 session 解码后不少于 32 bytes。全部输入通过后才创建同目录 mode-600 临时文件，任何失败由 trap 清理；最后一次原子 `mv` 才会替换正式 env，因此失败不会写入空的 `.env.production`。

```bash
sudo bash <<'BASH'
set -Eeuo pipefail
cd /srv/laogong-caipu/app

tmp_env=""
cleanup() {
  local status=$?
  unset FAMILY_PASSWORD_HASH FAMILY_SESSION_SECRET DEEPSEEK_API_KEY MICU_API_KEY
  if [[ -n "${tmp_env:-}" ]]; then rm -f -- "$tmp_env"; fi
  return "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

decode_base64url() {
  local value="$1" padded
  padded="$(printf '%s' "$value" | tr '_-' '/+')"
  case $((${#padded} % 4)) in
    0) ;;
    2) padded+="==" ;;
    3) padded+="=" ;;
    *) return 1 ;;
  esac
  printf '%s' "$padded" | openssl base64 -d -A
}

canonical_base64url() {
  local value="$1" expected_bytes="$2" byte_count roundtrip
  byte_count="$(decode_base64url "$value" | wc -c | tr -d '[:space:]')"
  [[ "$byte_count" =~ ^[0-9]+$ && "$byte_count" -eq "$expected_bytes" ]] || return 1
  roundtrip="$(decode_base64url "$value" | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
  [[ "$roundtrip" == "$value" ]]
}

read -rsp "粘贴 FAMILY_PASSWORD_HASH（输入隐藏）: " FAMILY_PASSWORD_HASH </dev/tty
printf '\n' >/dev/tty
if [[ ! "$FAMILY_PASSWORD_HASH" =~ ^scrypt\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$ ]]; then
  printf '%s\n' 'family password hash rejected' >&2
  exit 1
fi
canonical_base64url "${BASH_REMATCH[1]}" 16 || { printf '%s\n' 'family password hash rejected' >&2; exit 1; }
canonical_base64url "${BASH_REMATCH[2]}" 64 || { printf '%s\n' 'family password hash rejected' >&2; exit 1; }

FAMILY_SESSION_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
session_bytes="$(printf '%s' "$FAMILY_SESSION_SECRET" | openssl base64 -d -A | wc -c | tr -d '[:space:]')"
[[ "$session_bytes" =~ ^[0-9]+$ && "$session_bytes" -ge 32 ]] || { printf '%s\n' 'session secret generation failed' >&2; exit 1; }
unset session_bytes

read -rsp "DeepSeek API key（mock 模式可直接回车）: " DEEPSEEK_API_KEY </dev/tty
printf '\n' >/dev/tty
read -rsp "Micu API key（不生成食材图可直接回车）: " MICU_API_KEY </dev/tty
printf '\n' >/dev/tty
case "$DEEPSEEK_API_KEY$MICU_API_KEY" in *"'"*) printf '%s\n' 'API key contains an unsupported quote' >&2; exit 1;; esac

umask 077
tmp_env="$(mktemp .env.production.tmp.XXXXXX)"
chmod 600 "$tmp_env"
{
  printf "AI_PROVIDER='%s'\n" "deepseek"
  printf "DEEPSEEK_API_KEY='%s'\n" "$DEEPSEEK_API_KEY"
  printf "DEEPSEEK_MODEL='%s'\n" "deepseek-v4-pro"
  printf "MICU_API_KEY='%s'\n" "$MICU_API_KEY"
  printf "FAMILY_PASSWORD_HASH='%s'\n" "$FAMILY_PASSWORD_HASH"
  printf "FAMILY_SESSION_SECRET='%s'\n" "$FAMILY_SESSION_SECRET"
  printf "DATABASE_PATH=/app/data/laogong-caipu.sqlite\n"
  printf "BACKUP_ROOT=/app/backups\n"
} >"$tmp_env"
chown root:root "$tmp_env"
mv -- "$tmp_env" .env.production
tmp_env=""
chmod 600 .env.production
unset FAMILY_PASSWORD_HASH FAMILY_SESSION_SECRET DEEPSEEK_API_KEY MICU_API_KEY
BASH
```

使用 mock AI 时，把脚本里固定的 `deepseek` 改为 `mock`，API key 保持空值。不要运行 `cat .env.production`、`env`、`docker compose config` 或 `set -x`，这些操作可能打印秘密。只检查 metadata：

```bash
sudo stat -c '%a %u:%g %n' /srv/laogong-caipu/app/.env.production
```

期望 mode 为 `600`，owner 为 `0:0`。正式 env 的内容不得出现在命令输出或报告中。

## 3. 构建、启动和健康检查

Compose 只定义一个 `app` 服务，Next.js 在容器内监听 `0.0.0.0:3000`，宿主机只发布 `127.0.0.1:3000`。生产入口是 `next build` 后的 `next start`，不是开发服务器。以下命令只用于受控环境验证；Node 20 EOL、Next 14 unsupported 和 audit findings 解决前不得接入公网。

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
    header_up X-Forwarded-Host {http.request.host}
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
        proxy_set_header X-Forwarded-Host $host;
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

### 备份锁故障恢复

备份进程用 `backups/.backup-data.lock` 串行化目标检查、发布和保留清理。锁文件只记录随机 owner、容器内 PID 和开始时间，不含密钥。进程崩溃可能留下 stale lock；这是 fail-closed 状态，**不得仅根据锁文件时间自动删除**，也不要在仍有备份运行时删除。先暂停 cron，再确认没有 Compose one-off 容器或宿主机备份进程，检查元数据后只删除已确认的 stale lock：

```bash
sudo bash <<'BASH'
set -Eeuo pipefail
mv /etc/cron.d/laogong-caipu-backup /etc/cron.d/laogong-caipu-backup.disabled
cd /srv/laogong-caipu/app
active_oneoffs="$(docker ps -q \
  --filter label=com.docker.compose.oneoff=True)"
if [[ -n "$active_oneoffs" ]]; then
  printf '%s\n' '仍有 Compose one-off 容器运行；禁止删除备份锁。' >&2
  exit 1
fi
if pgrep -af 'backup-data\.mjs|npm run backup'; then
  printf '%s\n' '仍有宿主机备份进程运行；禁止删除备份锁。' >&2
  exit 1
fi
[[ -f backups/.backup-data.lock && ! -L backups/.backup-data.lock ]]
sed -n '1p' backups/.backup-data.lock
read -r -p '确认上一行仅含 owner、pid、startedAt，且对应进程已不存在；输入 verified 继续：' confirmation
[[ "$confirmation" == verified ]]
rm -- backups/.backup-data.lock
mv /etc/cron.d/laogong-caipu-backup.disabled /etc/cron.d/laogong-caipu-backup
docker compose run --rm --no-deps app npm run backup -- --kind daily
BASH
```

## 6. 发布升级与回滚

每段命令都在明确的 Bash fail-fast subshell 中运行。任一 predeploy、Git、build、stop、启动或健康检查失败都会立即停止后续步骤；不要从失败行之后手工“接着跑”。把 `main` 换成实际发布分支。

### 升级

升级先在线创建 `predeploy` 备份，再记录旧提交。build 失败时不会主动停止当前容器：

```bash
sudo bash <<'BASH'
set -Eeuo pipefail
cd /srv/laogong-caipu/app
on_error() {
  local status=$?
  printf '%s\n' '升级失败：已停止后续步骤；检查当前容器和 Git 状态后人工处理。' >&2
  exit "$status"
}
trap on_error ERR

docker compose run --rm --no-deps app npm run backup -- --kind predeploy
git rev-parse HEAD > /srv/laogong-caipu/previous-release.tmp
mv -- /srv/laogong-caipu/previous-release.tmp /srv/laogong-caipu/previous-release
git fetch --prune origin
git switch main
git pull --ff-only origin main
docker compose build
docker compose up -d app
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
trap - ERR
BASH
```

### 应用回滚

应用版本回滚不会自动回滚数据。回滚也先备份当前数据，并在停止 app 前完成旧提交镜像 build。只有在新版本确实执行了不兼容的数据迁移时，才按下一节恢复已验证的数据库备份：

```bash
sudo bash <<'BASH'
set -Eeuo pipefail
cd /srv/laogong-caipu/app
app_stopped=0
assert_app_stopped() {
  local ids id running
  ids="$(docker compose ps -a -q app)" || return
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    running="$(docker inspect --format '{{.State.Running}}' "$id")" || return
    [[ "$running" == "false" ]] || return 1
  done <<< "$ids"
}
on_error() {
  local status=$?
  if [[ "$app_stopped" -eq 1 ]]; then
    docker compose stop app >/dev/null 2>&1 || true
    printf '%s\n' '回滚失败：app 保持停止；检查镜像、Git 和日志后人工恢复，禁止跳过步骤。' >&2
  else
    printf '%s\n' '回滚失败：后续步骤已停止；当前容器未被本脚本主动停服，请人工检查。' >&2
  fi
  exit "$status"
}
trap on_error ERR

docker compose run --rm --no-deps app npm run backup -- --kind predeploy
PREVIOUS_REV="$(cat /srv/laogong-caipu/previous-release)"
[[ "$PREVIOUS_REV" =~ ^[0-9a-f]{40}$ ]]
git switch --detach "$PREVIOUS_REV"
unset PREVIOUS_REV
docker compose build
docker compose stop app
app_stopped=1
assert_app_stopped
docker compose up -d app
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
app_stopped=0
trap - ERR
BASH
```

## 7. 完整性验证与恢复

恢复脚本发生任何错误时都会停止后续命令。只要已进入停机修改阶段，错误 trap 会再次 stop 并明确报告 **app 保持停止**；必须人工检查数据、staging 和日志后重新执行完整流程，不能在失败行后继续执行。

### 数据库恢复

从 `backups/` 选择一个**文件名**替换占位符，不要输入路径。严格 allowlist 和只读 `PRAGMA integrity_check` 通过后，脚本先创建当前库的 online predeploy backup；然后 stop 并通过 Docker inspect 确认所有 app 容器都已完全停止，才会 install、`mv` 或清理 WAL/SHM。stop 或断言失败时不会修改数据库。

```bash
sudo bash <<'BASH'
set -Eeuo pipefail
cd /srv/laogong-caipu/app
BACKUP_FILE=predeploy-REPLACE_WITH_TIMESTAMP.sqlite
recovery_started=0
assert_app_stopped() {
  local ids id running
  ids="$(docker compose ps -a -q app)" || return
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    running="$(docker inspect --format '{{.State.Running}}' "$id")" || return
    [[ "$running" == "false" ]] || return 1
  done <<< "$ids"
}
on_error() {
  local status=$?
  if [[ "$recovery_started" -eq 1 ]]; then
    docker compose stop app >/dev/null 2>&1 || true
    printf '%s\n' '数据库恢复失败：app 保持停止；检查 data、backups 和日志后人工恢复。' >&2
  else
    printf '%s\n' '数据库恢复在修改前失败：未执行停机数据修改；请修正后从头运行。' >&2
  fi
  exit "$status"
}
trap on_error ERR

[[ "$BACKUP_FILE" =~ ^(daily|weekly|predeploy)-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z\.sqlite$ ]]
test -f "backups/$BACKUP_FILE"
docker compose run --rm --no-deps app node -e 'const Database=require("better-sqlite3"); const db=new Database(process.argv[1],{readonly:true,fileMustExist:true}); try { const rows=db.pragma("integrity_check"); if(rows.length!==1||rows[0].integrity_check!=="ok") process.exitCode=1; else console.log("integrity_check=ok"); } finally { db.close(); }' "/app/backups/$BACKUP_FILE"
docker compose run --rm --no-deps app npm run backup -- --kind predeploy
docker compose stop app
recovery_started=1
assert_app_stopped
install -o 10001 -g 10001 -m 0600 "backups/$BACKUP_FILE" data/.restore-laogong-caipu.sqlite
mv -- data/.restore-laogong-caipu.sqlite data/laogong-caipu.sqlite
rm -f -- data/laogong-caipu.sqlite-wal data/laogong-caipu.sqlite-shm
docker compose run --rm --no-deps app node -e 'const Database=require("better-sqlite3"); const db=new Database(process.argv[1],{readonly:true,fileMustExist:true}); try { const rows=db.pragma("integrity_check"); if(rows.length!==1||rows[0].integrity_check!=="ok") process.exitCode=1; else console.log("integrity_check=ok"); } finally { db.close(); }' /app/data/laogong-caipu.sqlite
docker compose up -d app
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
recovery_started=0
unset BACKUP_FILE
trap - ERR
BASH
```

### 图片恢复

图片恢复先在线执行 weekly 安全备份，再 stop 并检查所有 app 容器确实停止。停机断言通过后，脚本才校验真实 `/srv/laogong-caipu/backups` 根目录和选中的图片来源、临时收紧其所有权、拒绝顶层或嵌套 symlink，并复制到 root 所有的 `/srv/laogong-caipu/.restore-staging.*`；不会信任 app 可写的 `backups/` 内 staging。目标校验针对 `/srv/laogong-caipu/data`，不会把仓库中的 `app/data` symlink 当成持久化根目录。来源和目标在校验与复制/同步期间保持 root 所有，以阻止 UID 10001 替换路径；成功后才恢复应用所有权。如果停机后的任一步失败，app 保持停止，staging 及被保护目录的状态会保留供人工恢复，不会自动继续或自动启动。

```bash
sudo bash <<'BASH'
set -Eeuo pipefail
cd /srv/laogong-caipu/app
IMAGE_BACKUP=weekly-images-REPLACE_WITH_TIMESTAMP
recovery_started=0
restore_source=""
backup_root_real=""
source_real=""
assert_app_stopped() {
  local ids id running
  ids="$(docker compose ps -a -q app)" || return
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    running="$(docker inspect --format '{{.State.Running}}' "$id")" || return
    [[ "$running" == "false" ]] || return 1
  done <<< "$ids"
}
on_error() {
  local status=$?
  if [[ "$recovery_started" -eq 1 ]]; then
    docker compose stop app >/dev/null 2>&1 || true
    printf '图片恢复失败：app 保持停止；staging=%s，backups/source/data 可能保持 root 所有，请人工检查后恢复。\n' "${restore_source:-<未创建>}" >&2
  else
    printf '图片恢复在修改前失败；如已创建 staging，它保留在 %s，请人工检查。\n' "$restore_source" >&2
  fi
  exit "$status"
}
trap on_error ERR

[[ "$IMAGE_BACKUP" =~ ^weekly-images-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z$ ]]
docker compose run --rm --no-deps app npm run backup -- --kind weekly
docker compose stop app
recovery_started=1
assert_app_stopped
BACKUP_ROOT=/srv/laogong-caipu/backups
BACKUP_SOURCE="$BACKUP_ROOT/$IMAGE_BACKUP"
[[ ! -L "$BACKUP_ROOT" && -d "$BACKUP_ROOT" ]] || {
  printf '%s\n' 'persistent backup root must be a real directory, not a symlink' >&2
  exit 1
}
backup_root_real="$(realpath -e -- "$BACKUP_ROOT")"
[[ "$backup_root_real" == "$BACKUP_ROOT" ]] || {
  printf '%s\n' 'persistent backup root resolved outside its canonical path' >&2
  exit 1
}
chown root:root -- "$backup_root_real"
chmod 0750 -- "$backup_root_real"
[[ ! -L "$BACKUP_SOURCE" && -d "$BACKUP_SOURCE" ]] || {
  printf '%s\n' 'image backup source must be a real directory, not a symlink' >&2
  exit 1
}
source_real="$(realpath -e -- "$BACKUP_SOURCE")"
[[ "$source_real" == "$BACKUP_ROOT/$IMAGE_BACKUP" ]] || {
  printf '%s\n' 'image backup source resolved outside the persistent backup root' >&2
  exit 1
}
chown root:root -- "$source_real"
chmod 0750 -- "$source_real"
if find "$source_real" -type l -print -quit | grep -q .; then
  printf '%s\n' 'image backup contains a symlink and was rejected' >&2
  exit 1
fi
umask 077
restore_source="$(mktemp -d /srv/laogong-caipu/.restore-staging.XXXXXX)"
cp -a -- "$source_real/." "$restore_source/"
DATA_ROOT=/srv/laogong-caipu/data
GENERATED_PATH="$DATA_ROOT/generated"
[[ ! -L "$DATA_ROOT" && -d "$DATA_ROOT" ]] || {
  printf '%s\n' 'persistent data root must be a real directory, not a symlink' >&2
  exit 1
}
data_root_real="$(realpath -e -- "$DATA_ROOT")"
[[ "$data_root_real" == "$DATA_ROOT" ]] || {
  printf '%s\n' 'persistent data root resolved outside its canonical path' >&2
  exit 1
}
chown root:root -- "$data_root_real"
chmod 0750 -- "$data_root_real"
if [[ -e "$GENERATED_PATH" || -L "$GENERATED_PATH" ]]; then
  [[ ! -L "$GENERATED_PATH" && -d "$GENERATED_PATH" ]] || {
    printf '%s\n' 'generated destination must be a real directory, not a symlink' >&2
    exit 1
  }
else
  install -d -o root -g root -m 0750 -- "$GENERATED_PATH"
fi
generated_real="$(realpath -e -- "$GENERATED_PATH")"
[[ "$generated_real" == "$DATA_ROOT/generated" ]] || {
  printf '%s\n' 'generated destination resolved outside the persistent data root' >&2
  exit 1
}
chown root:root -- "$generated_real"
chmod 0750 -- "$generated_real"
rsync -a --delete "$restore_source/" "$generated_real/"
chown -R 10001:10001 -- "$generated_real"
chown 10001:10001 -- "$data_root_real"
docker compose up -d app
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
rm -rf -- "$restore_source"
restore_source=""
chown 10001:10001 -- "$source_real"
chown 10001:10001 -- "$backup_root_real"
source_real=""
backup_root_real=""
recovery_started=0
unset IMAGE_BACKUP
trap - ERR
BASH
```

## 单实例强制边界

**禁止启动第二个 app 实例挂载并写入同一个 SQLite 文件，也不要执行 `docker compose up --scale app=2`。** SQLite WAL 能改善同一实例中的并发，但不能把共享 bind mount 变成多副本数据库。需要横向扩容时，应先迁移到支持多实例的数据库并设计迁移与回滚方案。
