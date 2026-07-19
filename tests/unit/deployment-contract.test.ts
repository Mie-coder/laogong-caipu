import Database from "better-sqlite3";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const backupScript = join(projectRoot, "scripts", "backup-data.mjs");
const exactTimestamp = "\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z";

function exactDatabaseBackup(kind: "daily" | "weekly" | "predeploy") {
  return new RegExp(`^${kind}-${exactTimestamp}\\.sqlite$`);
}

const exactWeeklyImages = new RegExp(`^weekly-images-${exactTimestamp}$`);

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "laogong-deployment-"));
  const databasePath = join(root, "data", "recipes.sqlite");
  const backupRoot = join(root, "backups");
  await mkdir(dirname(databasePath), { recursive: true });
  await mkdir(backupRoot, { recursive: true });

  const database = new Database(databasePath);
  database.exec("CREATE TABLE recipes (id INTEGER PRIMARY KEY, title TEXT NOT NULL)");
  database.prepare("INSERT INTO recipes (title) VALUES (?)").run("番茄炒蛋");
  database.close();

  return { root, databasePath, backupRoot };
}

async function runBackup(options: {
  databasePath: string;
  backupRoot: string;
  kind: string;
  now?: string;
  nodeEnv?: string;
}) {
  return execFileAsync(process.execPath, [backupScript, "--kind", options.kind], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_PATH: options.databasePath,
      BACKUP_ROOT: options.backupRoot,
      FAMILY_SESSION_SECRET: "test-secret-that-must-not-leak",
      DEEPSEEK_API_KEY: "test-api-key-that-must-not-leak",
      NODE_ENV: options.nodeEnv ?? "test",
      ...(options.now ? { BACKUP_NOW: options.now } : {})
    }
  });
}

async function namesIn(directory: string) {
  return (await readdir(directory)).sort();
}

async function entriesIn(directory: string) {
  return (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
}

describe("persistent deployment contract", () => {
  it("creates a readable online SQLite backup containing real rows", async () => {
    const fixture = await createFixture();
    try {
      const result = await runBackup({
        ...fixture,
        kind: "daily",
        now: "2026-07-19T01:02:03.004Z"
      });
      const [backupName] = (await namesIn(fixture.backupRoot)).filter((name) => name.endsWith(".sqlite"));
      expect(backupName).toBe("daily-2026-07-19T01-02-03-004Z.sqlite");

      const backup = new Database(join(fixture.backupRoot, backupName), { readonly: true });
      expect(backup.prepare("SELECT title FROM recipes").get()).toEqual({ title: "番茄炒蛋" });
      backup.close();
      expect(result.stdout).not.toContain("DATABASE_PATH");
      expect(result.stdout).not.toContain("FAMILY_SESSION_SECRET");
      expect(result.stdout).not.toContain("test-secret-that-must-not-leak");
      expect(result.stderr).not.toContain("test-api-key-that-must-not-leak");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("retains only the seven newest daily database backups", async () => {
    const fixture = await createFixture();
    try {
      const lookalikeFile = "daily-9999-lookalike.sqlite";
      const exactLookingDirectory = "daily-2026-06-30T03-00-00-000Z.sqlite";
      await writeFile(join(fixture.backupRoot, lookalikeFile), "operator file");
      await mkdir(join(fixture.backupRoot, exactLookingDirectory));

      for (let day = 1; day <= 8; day += 1) {
        await runBackup({
          ...fixture,
          kind: "daily",
          now: `2026-07-${String(day).padStart(2, "0")}T03:00:00.000Z`
        });
      }

      const entries = await entriesIn(fixture.backupRoot);
      const names = entries.map((entry) => entry.name);
      const backups = entries
        .filter((entry) => entry.isFile() && exactDatabaseBackup("daily").test(entry.name))
        .map((entry) => entry.name);
      expect(backups).toHaveLength(7);
      expect(backups).not.toContain("daily-2026-07-01T03-00-00-000Z.sqlite");
      expect(backups.at(-1)).toBe("daily-2026-07-08T03-00-00-000Z.sqlite");
      expect(names).toContain(lookalikeFile);
      expect(names).toContain(exactLookingDirectory);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 20_000);

  it("rejects backup kinds outside the allowlist without creating a file", async () => {
    const fixture = await createFixture();
    try {
      await expect(runBackup({ ...fixture, kind: "../../escape" })).rejects.toMatchObject({
        code: expect.any(Number),
        stderr: expect.stringContaining("daily|weekly|predeploy")
      });
      expect(await namesIn(fixture.backupRoot)).toEqual([]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("retains four weekly image snapshots and copies generated images", async () => {
    const fixture = await createFixture();
    try {
      const generated = join(dirname(fixture.databasePath), "generated");
      await mkdir(generated, { recursive: true });
      await writeFile(join(generated, "ingredient.webp"), "image fixture");
      const databaseLookalike = "weekly-9999-lookalike.sqlite";
      const imageLookalike = "weekly-images-9999-lookalike";
      const exactLookingDatabaseDirectory = "weekly-2025-12-01T04-00-00-000Z.sqlite";
      const exactLookingImageFile = "weekly-images-2025-12-01T04-00-00-000Z";
      await writeFile(join(fixture.backupRoot, databaseLookalike), "operator file");
      await mkdir(join(fixture.backupRoot, imageLookalike));
      await mkdir(join(fixture.backupRoot, exactLookingDatabaseDirectory));
      await writeFile(join(fixture.backupRoot, exactLookingImageFile), "operator file");

      for (let week = 1; week <= 5; week += 1) {
        await runBackup({
          ...fixture,
          kind: "weekly",
          now: `2026-0${week}-01T04:00:00.000Z`
        });
      }

      const entries = await entriesIn(fixture.backupRoot);
      const names = entries.map((entry) => entry.name);
      const imageSnapshots = entries
        .filter((entry) => entry.isDirectory() && exactWeeklyImages.test(entry.name))
        .map((entry) => entry.name);
      const databaseBackups = entries
        .filter((entry) => entry.isFile() && exactDatabaseBackup("weekly").test(entry.name))
        .map((entry) => entry.name);
      expect(imageSnapshots).toHaveLength(4);
      expect(databaseBackups).toHaveLength(4);
      expect(imageSnapshots).not.toContain("weekly-images-2026-01-01T04-00-00-000Z");
      await expect(readFile(join(fixture.backupRoot, imageSnapshots.at(-1)!, "ingredient.webp"), "utf8")).resolves.toBe(
        "image fixture"
      );
      expect(names).toEqual(
        expect.arrayContaining([
          databaseLookalike,
          imageLookalike,
          exactLookingDatabaseDirectory,
          exactLookingImageFile
        ])
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 20_000);

  it("still creates a weekly database backup when generated images do not exist", async () => {
    const fixture = await createFixture();
    try {
      await expect(
        runBackup({ ...fixture, kind: "weekly", now: "2026-07-19T05:00:00.000Z" })
      ).resolves.toMatchObject({ stderr: "" });
      expect(await namesIn(fixture.backupRoot)).toEqual(["weekly-2026-07-19T05-00-00-000Z.sqlite"]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("retains only the three newest predeploy database backups", async () => {
    const fixture = await createFixture();
    try {
      for (let release = 1; release <= 4; release += 1) {
        await runBackup({
          ...fixture,
          kind: "predeploy",
          now: `2026-07-19T0${release}:00:00.000Z`
        });
      }

      const backups = (await namesIn(fixture.backupRoot)).filter((name) => exactDatabaseBackup("predeploy").test(name));
      expect(backups).toEqual([
        "predeploy-2026-07-19T02-00-00-000Z.sqlite",
        "predeploy-2026-07-19T03-00-00-000Z.sqlite",
        "predeploy-2026-07-19T04-00-00-000Z.sqlite"
      ]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects an invalid test clock without leaving a partial backup", async () => {
    const fixture = await createFixture();
    try {
      await expect(runBackup({ ...fixture, kind: "daily", now: "not-an-iso-time" })).rejects.toMatchObject({
        stderr: "Backup failed\n"
      });
      expect(await namesIn(fixture.backupRoot)).toEqual([]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("removes its partial database file when SQLite online backup fails", async () => {
    const fixture = await createFixture();
    try {
      await writeFile(fixture.databasePath, "not a sqlite database");
      await expect(
        runBackup({ ...fixture, kind: "daily", now: "2026-07-19T05:30:00.000Z" })
      ).rejects.toMatchObject({ stderr: "Backup failed\n" });
      expect(await namesIn(fixture.backupRoot)).toEqual([]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("never overwrites or removes pre-existing backup destinations", async () => {
    const fixture = await createFixture();
    try {
      const databaseCollision = "daily-2026-07-19T06-00-00-000Z.sqlite";
      await writeFile(join(fixture.backupRoot, databaseCollision), "operator-owned content");
      await expect(
        runBackup({ ...fixture, kind: "daily", now: "2026-07-19T06:00:00.000Z" })
      ).rejects.toMatchObject({ stderr: "Backup failed\n" });
      await expect(readFile(join(fixture.backupRoot, databaseCollision), "utf8")).resolves.toBe(
        "operator-owned content"
      );

      const imageCollision = "weekly-images-2026-07-19T07-00-00-000Z";
      await mkdir(join(dirname(fixture.databasePath), "generated"));
      await writeFile(join(dirname(fixture.databasePath), "generated", "ingredient.webp"), "new image");
      await mkdir(join(fixture.backupRoot, imageCollision));
      await writeFile(join(fixture.backupRoot, imageCollision, "keep.txt"), "operator-owned image snapshot");
      await expect(
        runBackup({ ...fixture, kind: "weekly", now: "2026-07-19T07:00:00.000Z" })
      ).rejects.toMatchObject({ stderr: "Backup failed\n" });
      await expect(readFile(join(fixture.backupRoot, imageCollision, "keep.txt"), "utf8")).resolves.toBe(
        "operator-owned image snapshot"
      );
      expect(await namesIn(fixture.backupRoot)).not.toContain("weekly-2026-07-19T07-00-00-000Z.sqlite");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("ignores BACKUP_NOW outside the test environment", async () => {
    const fixture = await createFixture();
    try {
      await runBackup({
        ...fixture,
        kind: "predeploy",
        now: "2001-01-01T00:00:00.000Z",
        nodeEnv: "production"
      });
      const [backupName] = await namesIn(fixture.backupRoot);
      expect(backupName).toMatch(/^predeploy-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/);
      expect(backupName).not.toContain("2001-01-01");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("pins the Node 20 deployment engine in package metadata and its npm lock", async () => {
    const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
    const packageLock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));

    expect(packageJson.engines).toEqual({ node: ">=20.9 <21" });
    expect(packageJson.scripts).toMatchObject({
      dev: "next dev",
      build: "next build",
      start: "next start",
      backup: "node scripts/backup-data.mjs",
      "auth:hash": "node scripts/hash-family-password.mjs"
    });
    expect(packageLock.packages[""].engines).toEqual({ node: ">=20.9 <21" });
    expect(packageLock.packages[""].dependencies).toEqual(packageJson.dependencies);
  });

  it("builds and runs one non-root production app with loopback-only persistent mounts", async () => {
    const dockerfile = await readFile(join(projectRoot, "Dockerfile"), "utf8");
    const compose = await readFile(join(projectRoot, "compose.yaml"), "utf8");

    expect(dockerfile.match(/FROM node:20-bookworm-slim/g)).toHaveLength(3);
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain("RUN npm ci --omit=dev");
    expect(dockerfile).toContain("ENV NODE_ENV=production");
    expect(dockerfile).toContain("HOSTNAME=0.0.0.0");
    expect(dockerfile).toMatch(/USER app(?:user)?/);
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]');
    expect(dockerfile).not.toContain("next dev");

    expect(compose).toMatch(/^services:\n  app:\n/m);
    expect(compose).toContain("127.0.0.1:3000:3000");
    expect(compose).toContain("./data:/app/data");
    expect(compose).toContain("./backups:/app/backups");
    expect(compose).toContain(".env.production");
    expect(compose).toContain("restart: unless-stopped");
    expect(compose).toContain("init: true");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toMatch(/cap_drop:\n\s+- ALL/);
    expect(compose).not.toMatch(/0\.0\.0\.0:3000:3000|^- "?3000:3000/m);
  });

  it("excludes all runtime data, outputs, dependencies, builds, and env files from Docker and Git", async () => {
    const dockerignore = await readFile(join(projectRoot, ".dockerignore"), "utf8");
    const gitignore = await readFile(join(projectRoot, ".gitignore"), "utf8");
    const envExample = await readFile(join(projectRoot, ".env.example"), "utf8");

    for (const ignored of [".env*", "data/", "backups/", "output/", ".next/", "node_modules/"]) {
      expect(dockerignore).toContain(ignored);
    }
    expect(gitignore).toContain(".env.production");
    expect(gitignore).toContain("backups/");

    const envLines = envExample.split("\n").filter((line) => line && !line.startsWith("#"));
    expect(envLines).toEqual([
      "AI_PROVIDER=",
      "DEEPSEEK_API_KEY=",
      "DEEPSEEK_MODEL=",
      "MICU_API_KEY=",
      "FAMILY_PASSWORD_HASH=",
      "FAMILY_SESSION_SECRET=",
      "DATABASE_PATH=",
      "BACKUP_ROOT="
    ]);
  });

  it("documents secure reverse proxies, secret-safe env creation, and the single-instance boundary", async () => {
    const runbook = await readFile(join(projectRoot, "docs", "deployment", "cloud-server.md"), "utf8");

    expect(runbook).toContain("chmod 600 .env.production");
    expect(runbook).toContain(`printf "FAMILY_PASSWORD_HASH='%s'\\n" "$FAMILY_PASSWORD_HASH"`);
    expect(runbook).toContain("127.0.0.1:3000");
    expect(runbook).toContain("proxy_set_header Host $host;");
    expect(runbook).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
    expect(runbook).toContain("proxy_set_header X-Forwarded-Host $host;");
    expect(runbook).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
    expect(runbook).toContain('proxy_set_header x-middleware-subrequest "";');
    expect(runbook).not.toContain("$proxy_add_x_forwarded_for");
    expect(runbook).toContain("header_up Host {http.request.host}");
    expect(runbook).toContain("header_up X-Forwarded-Proto https");
    expect(runbook).toContain("header_up X-Forwarded-Host {http.request.host}");
    expect(runbook).toContain("header_up X-Forwarded-For {http.request.remote.host}");
    expect(runbook).toContain("header_up -x-middleware-subrequest");
    expect(runbook).toContain("X-Content-Type-Options nosniff");
    expect(runbook).toContain("X-Frame-Options DENY");
    expect(runbook).toContain("Referrer-Policy strict-origin-when-cross-origin");
    expect(runbook).toMatch(/client_max_body_size\s+10m/);
    expect(runbook).toContain("proxy_read_timeout 60s");
    expect(runbook).toContain("Hermes");
    expect(runbook).toMatch(/占用.*3000.*只.*宿主机.*端口.*代理目标/s);
    expect(runbook).toMatch(/单实例|第二个.*实例/);
    expect(runbook).toContain("PRAGMA integrity_check");
    expect(runbook).toContain("unsupported");
    expect(runbook).toContain("受支持 LTS");
    expect(runbook).toMatch(/Node\.js 20.*EOL|Node 20.*EOL/s);
    expect(runbook).toMatch(/Node\.js (?:22|24)|Node (?:22|24)/);
    expect(runbook).not.toContain("Access-Control-Allow-Origin");
    expect(runbook).not.toContain("Strict-Transport-Security");
  });

  it("documents hidden validated secrets and an atomic env-file publication without server-side Node", async () => {
    const runbook = await readFile(join(projectRoot, "docs", "deployment", "cloud-server.md"), "utf8");
    const secretSection = runbook.slice(runbook.indexOf("## 2."), runbook.indexOf("## 3."));

    expect(secretSection).toContain("可信开发机");
    expect(secretSection).toContain("npm run --silent auth:hash");
    expect(secretSection).toContain('read -rsp "粘贴 FAMILY_PASSWORD_HASH');
    expect(secretSection).toContain("scrypt\\$");
    expect(secretSection).toContain("{22}");
    expect(secretSection).toContain("{86}");
    expect(secretSection).toContain("session_bytes");
    expect(secretSection).toContain("-ge 32");
    expect(secretSection).toContain("mktemp .env.production.tmp.XXXXXX");
    expect(secretSection).toContain("trap cleanup EXIT");
    expect(secretSection).toContain('mv -- "$tmp_env" .env.production');
    expect(secretSection).not.toContain('FAMILY_PASSWORD_HASH="$(sudo -u laogong-caipu npm');

    const validateHash = secretSection.indexOf("{86}");
    const validateSession = secretSection.indexOf("-ge 32");
    const createTemporaryFile = secretSection.indexOf("mktemp .env.production.tmp.XXXXXX");
    const publishEnvironment = secretSection.indexOf('mv -- "$tmp_env" .env.production');
    expect(validateHash).toBeGreaterThan(-1);
    expect(validateSession).toBeGreaterThan(validateHash);
    expect(createTemporaryFile).toBeGreaterThan(validateSession);
    expect(publishEnvironment).toBeGreaterThan(createTemporaryFile);
  });

  it("documents fail-fast deployment and stopped-app assertions before destructive recovery", async () => {
    const runbook = await readFile(join(projectRoot, "docs", "deployment", "cloud-server.md"), "utf8");
    const upgrade = runbook.slice(runbook.indexOf("## 6."), runbook.indexOf("## 7."));
    const restore = runbook.slice(runbook.indexOf("## 7."), runbook.indexOf("## 单实例"));
    const databaseRestore = restore.slice(0, restore.indexOf("### 图片恢复"));
    const imageRestore = restore.slice(restore.indexOf("### 图片恢复"));

    expect((runbook.match(/set -Eeuo pipefail/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(upgrade.indexOf("--kind predeploy")).toBeLessThan(upgrade.indexOf("git fetch"));
    expect(upgrade.indexOf("--kind predeploy")).toBeLessThan(upgrade.indexOf("docker compose build"));
    expect(upgrade).toContain("升级失败");
    expect(upgrade).toContain("回滚失败");

    for (const section of [databaseRestore, imageRestore]) {
      const stop = section.indexOf("docker compose stop app");
      const assertStopped = section.indexOf("\nassert_app_stopped\n", stop);
      expect(stop).toBeGreaterThan(-1);
      expect(assertStopped).toBeGreaterThan(stop);
      expect(section).toContain("app 保持停止");
    }
    const databaseStopAssertion = databaseRestore.indexOf(
      "\nassert_app_stopped\n",
      databaseRestore.indexOf("docker compose stop app")
    );
    const imageStopAssertion = imageRestore.indexOf(
      "\nassert_app_stopped\n",
      imageRestore.indexOf("docker compose stop app")
    );
    expect(databaseStopAssertion).toBeLessThan(databaseRestore.indexOf("data/.restore"));
    expect(databaseStopAssertion).toBeLessThan(databaseRestore.indexOf("mv -- data/.restore"));
    expect(databaseStopAssertion).toBeLessThan(databaseRestore.indexOf("sqlite-wal"));
    expect(imageStopAssertion).toBeLessThan(imageRestore.indexOf("rsync -a --delete"));
  });

  it("fails closed when Compose cannot enumerate app containers before recovery", async () => {
    const runbook = await readFile(join(projectRoot, "docs", "deployment", "cloud-server.md"), "utf8");
    const stoppedHelpers = [...runbook.matchAll(/assert_app_stopped\(\) \{([\s\S]*?)\n\}/g)].map((match) => match[1]);

    expect(stoppedHelpers).toHaveLength(3);
    expect(runbook).not.toContain("< <(docker compose ps -a -q app)");
    for (const helper of stoppedHelpers) {
      expect(helper).toContain("local ids id running");
      expect(helper).toContain('ids="$(docker compose ps -a -q app)" || return');
      expect(helper).toContain('while IFS= read -r id; do');
      expect(helper).toContain("docker inspect --format '{{.State.Running}}' \"$id\"");
      expect(helper).toContain('done <<< "$ids"');
    }
  });
});
