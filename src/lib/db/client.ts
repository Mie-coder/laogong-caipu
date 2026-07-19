import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "@/lib/db/schema";

let singleton: Database.Database | null = null;

export function configureDatabase(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
}

export function getDb(): Database.Database {
  if (singleton) return singleton;

  const databasePath = process.env.DATABASE_PATH ?? "./data/laogong-caipu.sqlite";
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  singleton = new Database(databasePath);
  configureDatabase(singleton);
  migrate(singleton);
  return singleton;
}
