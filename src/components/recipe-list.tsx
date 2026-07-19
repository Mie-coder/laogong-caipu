"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, MoreHorizontal, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeCard } from "@/components/recipe-card";
import { useForegroundRefresh } from "@/hooks/use-foreground-refresh";
import type { RecipeSummary } from "@/lib/domain/recipe-api";
import { deleteRecipeApi, listRecipesApi } from "@/lib/http/api-client";

type Filters = { category: string; tag: string; difficulty: string };
type QuickFilter = "" | "cooked";
const STORAGE_KEY = "recipe-list-return";

function buildListUrl(query: string, filters: Filters, quickFilter: QuickFilter = "") {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (quickFilter === "cooked") params.set("recent", "cooked");
  return params.size ? `/recipes?${params}` : "/recipes";
}

export function RecipeList({ category = "", tag = "" }: { category?: string; tag?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [filters, setFilters] = useState<Filters>({ category: searchParams.get("category") ?? category, tag: searchParams.get("tag") ?? tag, difficulty: searchParams.get("difficulty") ?? "" });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(searchParams.get("recent") === "cooked" ? "cooked" : "");
  const [view, setView] = useState<"recipes" | "categories">("recipes");
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [snapshot, setSnapshot] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [manage, setManage] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const restored = useRef(false);
  const restoreFrame = useRef<number | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const successfulRequestKey = useRef<string | null>(null);
  const currentUrl = buildListUrl(query, filters, quickFilter);
  const requestKey = JSON.stringify([query, filters.category, filters.tag, filters.difficulty]);

  const load = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    const preserveSnapshot = background && successfulRequestKey.current === requestKey;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    if (!preserveSnapshot) {
      successfulRequestKey.current = null;
      setLoading(true);
      setError("");
    }
    try {
      const result = await listRecipesApi({ query, category: filters.category, tag: filters.tag, difficulty: filters.difficulty }, next.signal);
      if (next.signal.aborted) return;
      successfulRequestKey.current = requestKey;
      setRecipes(result.recipes);
      setSnapshot((current) => current.length ? current : result.recipes);
      setError("");
    } catch (cause) {
      if (next.signal.aborted) return;
      if (preserveSnapshot) {
        toast.error("同步失败，已保留当前菜谱");
      } else {
        setRecipes([]);
        setError(cause instanceof Error ? cause.message : "加载失败，请重试");
      }
    } finally {
      if (!next.signal.aborted && controller.current === next) setLoading(false);
    }
  }, [filters.category, filters.difficulty, filters.tag, query, requestKey]);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  useForegroundRefresh(() => { void load({ background: true }); });

  useEffect(() => { restored.current = false; }, [query, filters.category, filters.tag, filters.difficulty]);
  useEffect(() => { if (pathname === "/recipes") router.replace(buildListUrl(query, filters, quickFilter), { scroll: false }); }, [pathname, query, filters, quickFilter, router]);
  useEffect(() => {
    if (loading || restored.current || recipes.length === 0) return;
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      const value = saved ? JSON.parse(saved) as { url?: string; scrollY?: number; searchOpen?: boolean } : null;
      if (value?.url === currentUrl && typeof value.scrollY === "number") {
        const scrollY = value.scrollY;
        if (value.searchOpen && !searchOpen) { setSearchOpen(true); return; }
        restoreFrame.current = window.requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
          restored.current = true;
          restoreFrame.current = null;
        });
        return () => { if (restoreFrame.current !== null) window.cancelAnimationFrame(restoreFrame.current); restoreFrame.current = null; };
      }
    } catch { window.sessionStorage.removeItem(STORAGE_KEY); }
  }, [currentUrl, loading, recipes.length, searchOpen]);

  const visible = quickFilter === "cooked" ? recipes.filter((recipe) => recipe.cookedCount > 0) : recipes;
  const categories = useMemo(() => ["全部", ...Array.from(new Set(snapshot.map((recipe) => recipe.mainCategory).filter(Boolean)))], [snapshot]);
  const tags = useMemo(() => ["全部", ...Array.from(new Set(snapshot.flatMap((recipe) => recipe.tags).filter(Boolean)))], [snapshot]);
  const difficulties = [["", "全部"], ["easy", "简单"], ["medium", "中等"], ["hard", "困难"]] as const;

  function openRecipe(recipe: RecipeSummary) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (manage) { toggleSelected(recipe.id); return; }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ url: currentUrl, scrollY: window.scrollY, searchOpen }));
    router.push(`/recipes/${recipe.id}`);
  }
  function updateFavorite(id: number, isFavorite: boolean) { setRecipes((current) => current.map((recipe) => recipe.id === id ? { ...recipe, isFavorite } : recipe)); }
  function toggleSelected(id: number) { setSelected((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function clearLongPress() { if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; } }
  function startLongPress(id: number) { clearLongPress(); longPress.current = setTimeout(() => { suppressClick.current = true; setManage(true); setSelected(new Set([id])); }, 500); }
  function exitManagement() { clearLongPress(); setDeleteError(""); setManage(false); setSelected(new Set()); }
  async function deleteSelected() {
    setDeleteError("");
    const failed = new Set<number>();
    await Promise.all([...selected].map(async (id) => { try { await deleteRecipeApi(id); } catch { failed.add(id); } }));
    setRecipes((old) => old.filter((recipe) => !selected.has(recipe.id) || failed.has(recipe.id)));
    setSelected(failed);
    setConfirmDelete(false);
    if (failed.size) setDeleteError("删除失败，请重试"); else { setDeleteError(""); exitManagement(); }
  }
  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters((old) => ({ ...old, [key]: value })); setDrawerOpen(false); }

  return <main className="v3-list" data-testid="recipe-list-v3">
    <header className="v3-list-header"><div><h1>我的菜谱</h1><p>收藏的每一道，都能认真做完</p><span className="sr-only">{`共 ${visible.length} 道`}</span></div><div className="v3-list-header-actions"><Button variant="ghost" size="icon" aria-label="搜索" className="v3-list-header-button" onClick={() => setSearchOpen((open) => !open)}><Search aria-hidden="true" /></Button><DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="更多" className="v3-list-header-button" onClick={() => setMoreOpen(true)}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setManage(true); setMoreOpen(false); }}>管理菜谱</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
    <div className={`v3-list-search ${searchOpen ? "is-open" : ""}`} aria-hidden={!searchOpen}><Search aria-hidden="true" /><Input aria-label="搜索菜名" placeholder="搜索菜名" value={query} onChange={(event) => setQuery(event.target.value)} /><Button variant="ghost" size="icon" aria-label="筛选" onClick={() => setDrawerOpen(true)}><SlidersHorizontal aria-hidden="true" /></Button></div>
    <div className="v3-segmented" role="tablist" aria-label="菜谱分段"><Button role="tab" variant={view === "recipes" ? "secondary" : "ghost"} aria-selected={view === "recipes"} onClick={() => setView("recipes")}>菜谱</Button><Button role="tab" variant={view === "categories" ? "secondary" : "ghost"} aria-selected={view === "categories"} onClick={() => setView("categories")}>分类</Button></div>
    {view === "categories" ? <section className="v3-category-view" aria-label="菜谱分类">{categories.slice(1).map((item) => <Button key={item} variant="ghost" onClick={() => { setFilter("category", item); setView("recipes"); }}><span>{item}</span><span>{snapshot.filter((recipe) => recipe.mainCategory === item).length}</span></Button>)}</section> : <div className="v3-chips" aria-label="分类筛选"><Button variant="ghost" aria-pressed={quickFilter === "" && !filters.category && !filters.tag && !filters.difficulty && !query} className={!filters.category && !filters.tag && !filters.difficulty && !query ? "is-active" : ""} onClick={() => { setQuery(""); setQuickFilter(""); setFilters({ category: "", tag: "", difficulty: "" }); }}>全部</Button><Button variant="ghost" aria-pressed={quickFilter === "cooked"} className={quickFilter === "cooked" ? "is-active" : ""} onClick={() => setQuickFilter((value) => value === "cooked" ? "" : "cooked")}>最近做过</Button>{categories.slice(1).map((item) => <Button key={item} variant="ghost" aria-pressed={filters.category === item} className={filters.category === item ? "is-active" : ""} onClick={() => setFilter("category", item)}>{item}</Button>)}</div>}
    {loading && <div className="v3-list-loading">{[0, 1, 2].map((key) => <Skeleton key={key} aria-label="菜谱加载中" className="h-28 w-full" />)}</div>}
    {!loading && error && <section className="v3-state"><p>{error}</p><Button variant="link" onClick={() => void load()}>重试</Button></section>}
    {!loading && !error && visible.length === 0 && <section className="v3-state"><p>还没有菜谱</p><Button variant="link" asChild><Link href="/">去导入</Link></Button></section>}
    {!loading && !error && view === "recipes" && visible.length > 0 && <section className="v3-list-results" aria-label="菜谱列表">{visible.map((recipe, index) => <div key={recipe.id} className="v3-recipe-wrap" onPointerDown={() => startLongPress(recipe.id)} onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onPointerLeave={clearLongPress}><RecipeCard recipe={recipe} fallbackImageUrl={`/stitch-v3/stitch-image-${["15", "14", "26", "01"][index % 4]}.jpg`} onOpen={() => openRecipe(recipe)} onFavoriteChanged={(isFavorite) => updateFavorite(recipe.id, isFavorite)} selected={selected.has(recipe.id)} onSelect={manage ? () => { if (suppressClick.current) { suppressClick.current = false; return; } toggleSelected(recipe.id); } : undefined} /></div>)}</section>}
    {deleteError && <p className="v3-delete-error" role="status">{deleteError}</p>}
    <Button asChild variant="outline" size="icon" className="v3-list-fab" aria-label="导入新菜谱"><Link href="/"><Plus aria-hidden="true" /></Link></Button>
    {manage && <aside className="v3-manage" aria-label="菜谱管理"><Checkbox aria-label="全选" checked={selected.size === recipes.length && recipes.length > 0} onCheckedChange={() => setSelected(selected.size === recipes.length ? new Set() : new Set(recipes.map((recipe) => recipe.id)))} /><span>{`已选 ${selected.size} 道`}</span><Button variant="ghost" size="icon" aria-label="退出管理" onClick={exitManagement}><X aria-hidden="true" /></Button><Button variant="destructive" disabled={selected.size === 0} onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" />删除已选</Button></aside>}
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除已选菜谱？</AlertDialogTitle><AlertDialogDescription>删除后无法恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void deleteSelected()}>删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}><DrawerContent><DrawerHeader><DrawerTitle>筛选菜谱</DrawerTitle></DrawerHeader><div className="v3-filter-drawer"><section><h3>分类</h3>{categories.map((item) => <Button key={item} aria-label={`分类 ${item}`} variant={filters.category === (item === "全部" ? "" : item) ? "secondary" : "ghost"} onClick={() => setFilter("category", item === "全部" ? "" : item)}>{item}</Button>)}</section><section><h3>标签</h3>{tags.map((item) => <Button key={item} aria-label={`标签 ${item}`} variant={filters.tag === (item === "全部" ? "" : item) ? "secondary" : "ghost"} onClick={() => setFilter("tag", item === "全部" ? "" : item)}>{item}</Button>)}</section><section><h3>难度</h3>{difficulties.map(([value, label]) => <Button key={value} aria-label={`难度 ${label}`} variant={filters.difficulty === value ? "secondary" : "ghost"} onClick={() => setFilter("difficulty", value)}>{label}</Button>)}</section></div></DrawerContent></Drawer>
  </main>;
}
