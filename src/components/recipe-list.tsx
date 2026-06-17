"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { listRecipesApi, deleteRecipeApi } from "@/lib/http/api-client";
import { RecipeCard, RecipeCardSummary } from "@/components/recipe-card";
import { SkeletonCard } from "@/components/skeleton-card";
import { Trash2, Filter, Check, X } from "lucide-react";

export function RecipeList({ category, tag }: { category?: string; tag?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("new");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [recipes, setRecipes] = useState<RecipeCardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Long-press delete mode
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    listRecipesApi({ query, category, tag, difficulty })
      .then((result) => setRecipes(result.recipes))
      .finally(() => setLoading(false));
  }, [query, category, tag, difficulty]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelectedIds(new Set());
  }

  async function batchDelete() {
    for (const id of selectedIds) {
      await deleteRecipeApi(id);
    }
    exitDeleteMode();
    load();
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  // Long press handler
  function handlePointerDown(id: number) {
    longPressTimer.current = setTimeout(() => {
      setDeleteMode(true);
      setSelectedIds(new Set([id]));
    }, 500);
  }
  function handlePointerUp() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }
  function handleClickCard(id: number) {
    if (deleteMode) {
      toggleSelect(id);
      return;
    }
    router.push(`/recipes/${id}`);
  }

  const difficultyLabels: Record<string, string> = {
    "": "全部难度",
    easy: "⭐ 简单",
    medium: "⭐⭐ 中等",
    hard: "⭐⭐⭐ 困难",
  };

  return (
    <section>
      <div className="mb-5">
        <p className="text-sm text-muted">已经收好的菜</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">菜谱</h1>
          {deleteMode ? (
            <div className="flex items-center gap-2">
              <button className="rounded-pill btn-ghost px-3 py-1.5 text-xs text-muted flex items-center gap-1" onClick={exitDeleteMode}>
                <X className="h-4 w-4" /> 取消
              </button>
              <button
                className="rounded-pill btn-primary px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1"
                onClick={batchDelete}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="h-4 w-4" /> 删除({selectedIds.size})
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted">长按进入删除模式</p>
          )}
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <input
          className="flex-1 rounded-pill glass-card border border-white/30 px-4 py-3 text-sm outline-none focus:border-coral/50"
          placeholder="搜索菜名"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="relative">
          <button
            className="flex items-center gap-1 rounded-pill glass-card border border-white/30 px-3.5 py-3 text-sm text-muted"
            onClick={() => setDifficultyOpen(!difficultyOpen)}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{difficultyLabels[difficulty]}</span>
          </button>
          <AnimatePresence>
            {difficultyOpen ? (
              <motion.div
                className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl glass-dialog border border-white/30"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                {Object.entries(difficultyLabels).map(([val, label]) => (
                  <button
                    key={val}
                    className={`w-full px-4 py-3 text-left text-sm transition active:bg-cream ${
                      difficulty === val ? "bg-apricot/30 font-semibold text-coral" : "text-ink"
                    }`}
                    onClick={() => { setDifficulty(val); setDifficultyOpen(false); }}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkeletonCard />
              <SkeletonCard />
            </motion.div>
          ) : recipes.length ? (
            recipes.map((recipe) => {
              const isNew = highlightId === String(recipe.id);
              const isSelected = selectedIds.has(recipe.id);
              return (
                <motion.div
                  key={recipe.id}
                  layout
                  initial={isNew ? { opacity: 0, y: 40, scale: 0.92 } : false}
                  animate={isNew ? { opacity: 1, y: 0, scale: 1 } : undefined}
                  transition={isNew ? { type: "spring", stiffness: 300, damping: 25, delay: 0.15 } : undefined}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.3 } }}
                  className={`relative rounded-2xl cursor-pointer ${
                    deleteMode ? (isSelected ? "ring-2 ring-coral" : "") : ""
                  }`}
                  onPointerDown={() => handlePointerDown(recipe.id)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onClick={() => handleClickCard(recipe.id)}
                >
                  <div className="rounded-2xl glass-card">
                    <RecipeCard recipe={recipe} disableLink />
                  </div>
                  {deleteMode ? (
                    <div className="absolute right-3 top-3 z-10">
                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${
                        isSelected ? "bg-coral border-coral" : "border-white/60 bg-white/30"
                      }`}>
                        {isSelected ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              );
            })
          ) : (
            <motion.div
              className="rounded-2xl glass-card p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-muted">还没有菜谱，去首页导入吧</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
