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
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recipe_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
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
      wife_rating INTEGER NOT NULL DEFAULT 0,
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

  const recipeColumns = db.prepare("PRAGMA table_info(recipes)").all() as Array<{ name: string }>;
  if (!recipeColumns.some((column) => column.name === "is_favorite")) {
    db.exec("ALTER TABLE recipes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0");
  }
}
