import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { configureDatabase } from "@/lib/db/client";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("database client", () => {
  it("configures the shared database for foreign keys, WAL, and a 5 second busy timeout", async () => {
    const root = await mkdtemp(join(tmpdir(), "laogong-db-"));
    roots.push(root);
    const db = new Database(join(root, "test.sqlite"));

    configureDatabase(db);

    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
    db.close();
  });
});
