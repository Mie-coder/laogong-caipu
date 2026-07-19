import Database from "better-sqlite3";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const KINDS = new Set(["daily", "weekly", "predeploy"]);
const DATABASE_RETENTION = { daily: 7, weekly: 4, predeploy: 3 };
const WEEKLY_IMAGE_RETENTION = 4;

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

async function createDatabaseBackup(databasePath, destination) {
  let database;
  let failure;
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true });
    await database.backup(destination);
  } catch (error) {
    failure = error;
  } finally {
    if (database?.open) database.close();
  }

  if (failure) {
    await rm(destination, { force: true });
    throw failure;
  }
}

async function createWeeklyImageSnapshot(databasePath, destination) {
  const source = join(dirname(databasePath), "generated");
  try {
    const sourceStat = await stat(source);
    if (!sourceStat.isDirectory()) throw new Error("generated images path is not a directory");
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
    return true;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const kind = readKind(process.argv.slice(2));
  const databasePath = resolve(process.env.DATABASE_PATH || "./data/laogong-caipu.sqlite");
  const backupRoot = resolve(process.env.BACKUP_ROOT || "./backups");
  const timestamp = timestampFor(backupTime());
  const databaseDestination = join(backupRoot, `${kind}-${timestamp}.sqlite`);

  await mkdir(backupRoot, { recursive: true });
  await createDatabaseBackup(databasePath, databaseDestination);
  const databaseCount = await retain(
    backupRoot,
    (entry) => entry.isFile() && new RegExp(`^${kind}-\\d{4}-.*\\.sqlite$`).test(entry.name),
    DATABASE_RETENTION[kind]
  );

  let imageDestination;
  let imageCount;
  if (kind === "weekly") {
    const candidate = join(backupRoot, `weekly-images-${timestamp}`);
    if (await createWeeklyImageSnapshot(databasePath, candidate)) imageDestination = candidate;
    imageCount = await retain(
      backupRoot,
      (entry) => entry.isDirectory() && /^weekly-images-\d{4}-/.test(entry.name),
      WEEKLY_IMAGE_RETENTION
    );
  }

  console.log(`database backup: ${databaseDestination}`);
  console.log(`database backups retained: ${databaseCount}`);
  if (imageDestination) console.log(`image snapshot: ${imageDestination}`);
  if (imageCount !== undefined) console.log(`image snapshots retained: ${imageCount}`);
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
