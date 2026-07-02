"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Filter, Search, Trash2, X } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { deleteRecipeApi, listRecipesApi } from "@/lib/http/api-client";
import { DIFFICULTY_LABELS } from "@/components/difficulty-stars";
import { RecipeCard, RecipeCardSummary } from "@/components/recipe-card";
import { SkeletonCard } from "@/components/skeleton-card";

type FilterValue = {
  category: string;
  tag: string;
  difficulty: string;
};

type SnapshotOptions = {
  categories: string[];
  tags: string[];
};

const STORAGE_KEY = "recipe-list-return";

function buildListUrl(params: { query?: string; category?: string; tag?: string; difficulty?: string }) {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.difficulty) search.set("difficulty", params.difficulty);
  const query = search.toString();
  return query ? `/recipes?${query}` : "/recipes";
}

function collectSnapshotOptions(recipes: RecipeCardSummary[]): SnapshotOptions {
  const categories = new Set<string>();
  const tags = new Set<string>();

  for (const recipe of recipes) {
    if (recipe.mainCategory) categories.add(recipe.mainCategory);
    for (const tag of recipe.tags) {
      if (tag) tags.add(tag);
    }
  }

  return {
    categories: [...categories],
    tags: [...tags]
  };
}

export function RecipeList({ category, tag }: { category?: string; tag?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("new");
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [filters, setFilters] = useState<FilterValue>({
    category: category ?? "",
    tag: tag ?? "",
    difficulty: ""
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recipes, setRecipes] = useState<RecipeCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [optionSnapshot, setOptionSnapshot] = useState<SnapshotOptions>({ categories: [], tags: [] });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const activeCategory = filters.category || category || "";
  const activeTag = filters.tag || tag || "";
  const currentUrl = buildListUrl({
    query,
    category: activeCategory,
    tag: activeTag,
    difficulty: filters.difficulty
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listRecipesApi({
        query,
        category: activeCategory,
        tag: activeTag,
        difficulty: filters.difficulty
      });
      setRecipes(result.recipes);
      setOptionSnapshot((current) => {
        if (current.categories.length || current.tags.length) {
          return current;
        }
        return collectSnapshotOptions(result.recipes);
      });
    } catch (loadError) {
      setRecipes([]);
      setError(loadError instanceof Error ? loadError.message : "加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeTag, filters.difficulty, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || restoredRef.current || recipes.length === 0) {
      return;
    }

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const saved = JSON.parse(raw) as { url?: string; scrollY?: number };
      if (saved.url === currentUrl && typeof saved.scrollY === "number") {
        window.scrollTo(0, saved.scrollY);
        restoredRef.current = true;
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [currentUrl, loading, recipes.length, searchParams]);

  useEffect(() => {
    restoredRef.current = false;
  }, [query, filters.category, filters.tag, filters.difficulty, category, tag]);

  const featuredRecipe = recipes[0];
  const rowRecipes = recipes.slice(1);
  const quickFilters = useMemo(
    () => [
      { label: "全部", active: !query && !filters.category && !filters.tag && !filters.difficulty, onClick: () => setFilters({ category: "", tag: "", difficulty: "" }) },
      { label: "最近做过", active: query === "做过", onClick: () => setQuery("做过") },
      { label: "简单", active: filters.difficulty === "easy", onClick: () => setFilters((current) => ({ ...current, difficulty: current.difficulty === "easy" ? "" : "easy" })) }
    ],
    [filters.category, filters.difficulty, filters.tag, query]
  );

  function saveReturnState() {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        url: currentUrl,
        scrollY: window.scrollY
      })
    );
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelectedIds(new Set());
    setDeleteError("");
  }

  function toggleSelect(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) {
      return;
    }
    if (!window.confirm("确认删除选中的菜谱吗？")) {
      return;
    }

    setDeleteError("");

    try {
      for (const id of selectedIds) {
        await deleteRecipeApi(id);
      }
      exitDeleteMode();
      await load();
    } catch {
      setDeleteError("删除失败，请重试");
    }
  }

  function handlePointerDown(id: number) {
    longPressTimer.current = setTimeout(() => {
      setDeleteMode(true);
      setSelectedIds(new Set([id]));
    }, 500);
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleOpenRecipe(id: number) {
    if (deleteMode) {
      toggleSelect(id);
      return;
    }
    saveReturnState();
    router.push(`/recipes/${id}`);
  }

  const highlightedTransition = reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" };

  return (
    <section className="pb-32">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-[1.25] text-ink">我的菜谱</h1>
          <p className="mt-3 text-[14px] leading-[1.5] text-muted">{`共 ${recipes.length} 道`}</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            aria-label="搜索"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
            onClick={() => document.getElementById("recipe-list-search")?.focus()}
          >
            <Search className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="管理"
            className="min-h-[44px] text-[17px] font-medium leading-[1.5] text-ink"
            onClick={() => setDeleteMode(true)}
          >
            管理
          </button>
        </div>
      </div>

      <div className="mt-8 border-b border-line pb-4">
        <label htmlFor="recipe-list-search" className="flex items-center gap-3 text-subtle">
          <Search className="h-6 w-6" aria-hidden="true" />
          <input
            id="recipe-list-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索菜名"
            className="w-full border-0 bg-transparent p-0 text-[17px] leading-[1.5] text-ink outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-8">
          {quickFilters.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`border-b-2 pb-3 text-[17px] leading-[1.5] ${
                item.active ? "border-accent font-semibold text-ink" : "border-transparent text-muted"
              }`}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="筛选"
          className="flex min-h-[44px] items-center gap-2 text-[17px] leading-[1.5] text-ink"
          onClick={() => setSheetOpen(true)}
        >
          <Filter className="h-5 w-5" aria-hidden="true" />
          <span>筛选</span>
        </button>
      </div>

      {deleteError ? <p className="mt-4 text-[14px] leading-[1.5] text-accent">{deleteError}</p> : null}
      {error ? (
        <div className="mt-8">
          <p className="text-[16px] leading-[1.65] text-ink">加载失败，请重试</p>
          <button type="button" className="mt-3 text-[14px] leading-[1.5] text-ink underline underline-offset-4" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}

      {!error && !loading && recipes.length === 0 ? (
        <div className="mt-12">
          <p className="text-[20px] font-semibold leading-[1.4] text-ink">还没有菜谱</p>
          <Link href="/" className="mt-3 inline-block text-[14px] leading-[1.5] text-ink underline underline-offset-4">
            去导入
          </Link>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="mt-10">
              <SkeletonCard featured />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!loading && !error && recipes.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-[20px] font-semibold leading-[1.4] text-ink">最近更新</h2>

          {featuredRecipe ? (
            <motion.div
              key={featuredRecipe.id}
              initial={highlightId === String(featuredRecipe.id) ? { opacity: 0 } : undefined}
              animate={{ opacity: 1 }}
              transition={highlightedTransition}
              className="mt-6"
            >
              <button
                type="button"
                aria-label={deleteMode ? `选择菜谱 ${featuredRecipe.name}` : `查看菜谱 ${featuredRecipe.name}`}
                className="block w-full text-left"
                onPointerDown={() => handlePointerDown(featuredRecipe.id)}
                onPointerUp={clearLongPress}
                onPointerLeave={clearLongPress}
                onClick={() => handleOpenRecipe(featuredRecipe.id)}
              >
                <div className="aspect-[16/9] w-full overflow-hidden rounded-[6px] bg-line">
                  {featuredRecipe.coverImageUrl ? (
                    <img
                      src={featuredRecipe.coverImageUrl}
                      alt={featuredRecipe.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[14px] text-subtle">无图</div>
                  )}
                </div>
                <div className="mt-5">
                  <h3 className="text-[28px] font-bold leading-[1.3] text-ink">{featuredRecipe.name}</h3>
                  <p className="mt-3 text-[16px] leading-[1.65] text-muted">
                    {[featuredRecipe.mainCategory, DIFFICULTY_LABELS[featuredRecipe.difficulty] ?? "未知", `做过 ${featuredRecipe.cookedCount} 次`, featuredRecipe.wifeRating > 0 ? `老婆评分 ${featuredRecipe.wifeRating.toFixed(1)}` : "评分 --"].join(" · ")}
                  </p>
                </div>
              </button>
              {deleteMode ? (
                <span className="pointer-events-none absolute right-0 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface">
                  {selectedIds.has(featuredRecipe.id) ? <Check className="h-4 w-4 text-accent" aria-hidden="true" /> : null}
                </span>
              ) : null}
            </motion.div>
          ) : null}

          <div className="mt-6">
            {rowRecipes.map((recipe) => {
              const isSelected = selectedIds.has(recipe.id);

              return (
                <motion.div
                  key={recipe.id}
                  initial={highlightId === String(recipe.id) ? { opacity: 0 } : undefined}
                  animate={{ opacity: 1 }}
                  transition={highlightedTransition}
                  className="relative border-t border-line"
                >
                  <button
                    type="button"
                    aria-label={deleteMode ? `选择菜谱 ${recipe.name}` : `查看菜谱 ${recipe.name}`}
                    className="block w-full text-left"
                    onPointerDown={() => handlePointerDown(recipe.id)}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onClick={() => handleOpenRecipe(recipe.id)}
                  >
                    <RecipeCard recipe={recipe} disableLink />
                  </button>
                  {deleteMode ? (
                    <span className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface">
                      {isSelected ? <Check className="h-4 w-4 text-accent" aria-hidden="true" /> : null}
                    </span>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : null}

      <BottomSheet open={sheetOpen} title="筛选菜谱" onClose={() => setSheetOpen(false)}>
        <div className="space-y-6 pb-4">
          <div>
            <p className="text-[14px] leading-[1.5] text-muted">分类</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="分类 全部"
                className={`rounded-[4px] border px-3 py-2 text-[14px] leading-[1.5] ${filters.category ? "border-line text-muted" : "border-accent text-ink"}`}
                onClick={() => setFilters((current) => ({ ...current, category: "" }))}
              >
                全部
              </button>
              {optionSnapshot.categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`分类 ${item}`}
                  className={`rounded-[4px] border px-3 py-2 text-[14px] leading-[1.5] ${filters.category === item ? "border-accent text-ink" : "border-line text-muted"}`}
                  onClick={() => setFilters((current) => ({ ...current, category: item }))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[14px] leading-[1.5] text-muted">标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="标签 全部"
                className={`rounded-[4px] border px-3 py-2 text-[14px] leading-[1.5] ${filters.tag ? "border-line text-muted" : "border-accent text-ink"}`}
                onClick={() => setFilters((current) => ({ ...current, tag: "" }))}
              >
                全部
              </button>
              {optionSnapshot.tags.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`标签 ${item}`}
                  className={`rounded-[4px] border px-3 py-2 text-[14px] leading-[1.5] ${filters.tag === item ? "border-accent text-ink" : "border-line text-muted"}`}
                  onClick={() => setFilters((current) => ({ ...current, tag: item }))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[14px] leading-[1.5] text-muted">难度</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "", label: "全部" },
                { value: "easy", label: "简单" },
                { value: "medium", label: "中等" },
                { value: "hard", label: "困难" }
              ].map((item) => (
                <button
                  key={item.value || "all"}
                  type="button"
                  aria-label={`难度 ${item.label}`}
                  className={`rounded-[4px] border px-3 py-2 text-[14px] leading-[1.5] ${filters.difficulty === item.value ? "border-accent text-ink" : "border-line text-muted"}`}
                  onClick={() => setFilters((current) => ({ ...current, difficulty: item.value }))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      {deleteMode ? (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-transparent px-5 pb-[calc(var(--safe-bottom)+16px)] pt-4">
          <div className="flex w-full max-w-[var(--app-max-width)] items-center justify-between border-t border-line bg-surface pt-4">
            <div>
              <p className="text-[16px] font-medium leading-[1.5] text-ink">{`已选 ${selectedIds.size} 道`}</p>
              {deleteError ? <p className="mt-1 text-[12px] leading-[1.4] text-accent">{deleteError}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink" onClick={exitDeleteMode} aria-label="退出管理">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="删除已选"
                className="flex h-12 items-center gap-2 rounded-[8px] bg-ink px-4 text-[16px] font-medium leading-[1.5] text-white disabled:bg-disabled"
                disabled={selectedIds.size === 0}
                onClick={() => void handleDeleteSelected()}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
