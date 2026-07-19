import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { cp, link, lstat, mkdir, readdir, rename, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const KINDS = new Set(["daily", "weekly", "predeploy"]);
const DATABASE_RETENTION = { daily: 7, weekly: 4, predeploy: 3 };
const WEEKLY_IMAGE_RETENTION = 4;
const TIMESTAMP_PATTERN = "\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z";
const DATABASE_BACKUP_PATTERNS = Object.fromEntries(
  [...KINDS].map((kind) => [kind, new RegExp(`^${kind}-${TIMESTAMP_PATTERN}\\.sqlite$`)])
);
const WEEKLY_IMAGE_PATTERN = new RegExp(`^weekly-images-${TIMESTAMP_PATTERN}$`);

function readKind(argv) {
  if (argv.length !== 2 || argv[0] !== "--kind" || !KINDS.has(argv[1])) {
    throw new Error("usage");
  }
  return argv[1];
}

function backupTime() {
  const value = process.env.NODE_ENV === "test" && process.env.BACKUP_NOW ? process.env.BACKUP_NOW : undefined;
  const now = value ? new Date(value) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("time");
  return now;
}

function timestampFor(now) {
  return now.toISOString().replace(/[:.]/g, "-");
}

async function retain(root, predicate, limit) {
  const entries = await readdir(root, { withFileTypes: true });
  const matches = entries
    .filter(predicate)
    .map((entry) => entry.name)
    .sort()
    .reverse();

  await Promise.all(matches.slice(limit).map((name) => rm(join(root, name), { recursive: true, force: true })));
  return Math.min(matches.length, limit);
}

async function assertDestinationAbsent(destination) {
  try {
    await lstat(destination);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("backup destination already exists");
}

async function withBackupWriterLock(backupRoot, action) {
  const writerLock = join(backupRoot, ".backup-data.lock");
  let lockHeld = false;
  try {
    await mkdir(writerLock, { mode: 0o700 });
    lockHeld = true;
    return await action();
  } finally {
    if (lockHeld) await rmdir(writerLock);
  }
}

async function createDatabaseBackup(databasePath, destination) {
  const partial = `${destination}.partial-${process.pid}-${randomUUID()}`;
  let database;
  let failure;
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true });
    await database.backup(partial);
    await link(partial, destination);
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (database?.open) database.close();
    } finally {
      await rm(partial, { force: true });
    }
  }

  if (failure) throw failure;
}

async function createWeeklyImageSnapshot(databasePath, destination) {
  const source = join(dirname(databasePath), "generated");
  try {
    const sourceStat = await stat(source);
    if (!sourceStat.isDirectory()) throw new Error("generated images path is not a directory");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }

  const partial = `${destination}.partial-${process.pid}-${randomUUID()}`;
  try {
    await cp(source, partial, { recursive: true, errorOnExist: true, force: false });
    await assertDestinationAbsent(destination);
    await rename(partial, destination);
    return true;
  } finally {
    await rm(partial, { recursive: true, force: true });
  }
}

async function main() {
  const kind = readKind(process.argv.slice(2));
  const databasePath = resolve(process.env.DATABASE_PATH || "./data/laogong-caipu.sqlite");
  const backupRoot = resolve(process.env.BACKUP_ROOT || "./backups");
  const timestamp = timestampFor(backupTime());
  const databaseDestination = join(backupRoot, `${kind}-${timestamp}.sqlite`);
  const imageDestination = kind === "weekly" ? join(backupRoot, `weekly-images-${timestamp}`) : undefined;

  await mkdir(backupRoot, { recursive: true });
  await withBackupWriterLock(backupRoot, async () => {
    await assertDestinationAbsent(databaseDestination);
    if (imageDestination) await assertDestinationAbsent(imageDestination);
    await createDatabaseBackup(databasePath, databaseDestination);
    const databaseCount = await retain(
      backupRoot,
      (entry) => entry.isFile() && DATABASE_BACKUP_PATTERNS[kind].test(entry.name),
      DATABASE_RETENTION[kind]
    );

    let createdImageDestination;
    let imageCount;
    if (kind === "weekly") {
      if (await createWeeklyImageSnapshot(databasePath, imageDestination)) createdImageDestination = imageDestination;
      imageCount = await retain(
        backupRoot,
        (entry) => entry.isDirectory() && WEEKLY_IMAGE_PATTERN.test(entry.name),
        WEEKLY_IMAGE_RETENTION
      );
    }

    console.log(`database backup: ${databaseDestination}`);
    console.log(`database backups retained: ${databaseCount}`);
    if (createdImageDestination) console.log(`image snapshot: ${createdImageDestination}`);
    if (imageCount !== undefined) console.log(`image snapshots retained: ${imageCount}`);
  });
}

try {
  await main();
} catch (error) {
  if (error instanceof Error && error.message === "usage") {
    console.error("Usage: npm run backup -- --kind daily|weekly|predeploy");
  } else {
    console.error("Backup failed");
  }
  process.exitCode = 1;
}
