"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Ellipsis, PencilLine, Star, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CookingLogSheet } from "@/components/cooking-log-sheet";
import { DIFFICULTY_LABELS } from "@/components/difficulty-stars";
import { FavoriteButton } from "@/components/recipe/favorite-button";
import { SkeletonCard } from "@/components/skeleton-card";
import { addCookingLogApi, deleteRecipeApi, getRecipeApi } from "@/lib/http/api-client";
import type { RecipeDetail as RecipeDetailData } from "@/lib/domain/recipe-api";
import { ApiError } from "@/lib/http/api-error";

const LIST_RETURN_KEY = "recipe-list-return";

function formatCookTime(minutes: number | null) { return minutes ? `${minutes} 分钟` : "时间未定"; }
function formatCookedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}月${date.getDate()}日`;
}
function listReturnUrl() {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(LIST_RETURN_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null && "url" in parsed && typeof parsed.url === "string" ? parsed.url : "/recipes";
  } catch {
    return "/recipes";
  }
}

export function RecipeDetail({ id, onStartCooking, onEditRecipe }: { id: number; onStartCooking?: (recipeId: number) => void; onEditRecipe?: (recipeId: number) => void }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetailData | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [activeTab, setActiveTab] = useState("ingredients");

  async function load() {
    try {
      setError(null);
      const result = await getRecipeApi(id);
      setRecipe(result.recipe);
      setImageFailed(false);
    } catch (cause) {
      setError({ message: cause instanceof Error ? cause.message : "加载失败，请重试", notFound: cause instanceof ApiError && (cause.code === "not_found" || cause.status === 404) });
    }
  }

  useEffect(() => { void load(); }, [id]);

  const heroImage = useMemo(() => recipe?.coverImageUrl ?? recipe?.imageUrls[0] ?? null, [recipe]);
  const prepItems = useMemo(() => recipe ? [...recipe.ingredients, ...recipe.seasonings] : [], [recipe]);

  async function deleteRecipe() {
    try {
      await deleteRecipeApi(id);
      router.push(listReturnUrl());
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "删除失败，请重试");
      setDeleteOpen(false);
    }
  }

  if (!recipe && !error) return <SkeletonCard />;
  if (error) return <main className="recipe-detail-error" data-transaction-screen="true"><Button variant="ghost" size="icon" aria-label="返回菜谱列表" data-press-feedback="apple" onClick={() => router.push(listReturnUrl())}><ChevronLeft aria-hidden="true" /></Button><section><h1>{error.notFound ? "菜谱没找到" : "加载失败"}</h1><p role="status">{error.message}</p>{!error.notFound ? <Button variant="outline" data-press-feedback="apple" onClick={() => void load()}>重试</Button> : null}</section></main>;
  if (!recipe) return null;

  const latestReview = recipe.cookingLogs[0] ?? null;
  return <main className="recipe-detail-v3" data-transaction-screen="true">
    <header className="recipe-detail-v3-header">
      <Button variant="secondary" size="icon" aria-label="返回菜谱列表" data-press-feedback="apple" onClick={() => router.push(listReturnUrl())}><ChevronLeft aria-hidden="true" /></Button>
      <div className="recipe-detail-v3-actions"><FavoriteButton recipeId={recipe.id} recipeName={recipe.name} isFavorite={recipe.isFavorite} onChanged={(isFavorite) => setRecipe((current) => current ? { ...current, isFavorite } : current)} />{onEditRecipe ? <Button variant="secondary" size="icon" aria-label="编辑菜谱" data-press-feedback="apple" onClick={() => onEditRecipe(recipe.id)}><PencilLine aria-hidden="true" /></Button> : null}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary" size="icon" aria-label="更多操作" data-press-feedback="apple"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem data-press-feedback="apple" onSelect={() => setDeleteOpen(true)}><Trash2 aria-hidden="true" />删除菜谱</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    </header>

    <section className="recipe-detail-v3-hero">
      <span aria-hidden="true" className="recipe-detail-v3-numeral">02</span>
      {heroImage && !imageFailed ? <img src={heroImage} alt={`${recipe.name} 菜谱封面`} className="recipe-detail-v3-hero-image" onError={() => setImageFailed(true)} /> : <div className="recipe-detail-v3-image-fallback" role="status">图片加载失败</div>}
      <div className="recipe-detail-v3-summary"><h1>{recipe.name}</h1><p>{recipe.mainCategory} · {formatCookTime(recipe.cookTimeMinutes)} · {DIFFICULTY_LABELS[recipe.difficulty] ?? "未知"} · 做过 {recipe.cookedCount} 次</p>{latestReview?.wifeRating ? <p className="recipe-detail-v3-rating"><Star aria-hidden="true" fill="currentColor" />老婆评分 {latestReview.wifeRating.toFixed(1)}</p> : null}</div>
    </section>

    <section className="recipe-detail-v3-body">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="recipe-detail-v3-tabs">
        <TabsList aria-label="菜谱内容"><TabsTrigger value="ingredients" onClick={() => setActiveTab("ingredients")}>食材</TabsTrigger><TabsTrigger value="steps" onClick={() => setActiveTab("steps")}>步骤</TabsTrigger></TabsList>
        <TabsContent value="ingredients"><section><h2>食材与调料</h2><div className="recipe-detail-v3-ingredients">{prepItems.map((item, index) => <div key={`${item.type}-${item.name}-${index}`}><span>{item.name}</span><span>{item.amount || "适量"}</span></div>)}</div></section></TabsContent>
        <TabsContent value="steps"><section><h2>制作步骤</h2><ol className="recipe-detail-v3-steps">{recipe.steps.map((step) => <li key={step.order}><span>{String(step.order).padStart(2, "0")}</span><p>{step.text}</p></li>)}</ol></section></TabsContent>
      </Tabs>
      <section className="recipe-detail-v3-review"><h2>最近复盘</h2>{latestReview ? <div><p>{latestReview.wifeFeedback || "暂无文字评价"}</p>{latestReview.husbandImprovementNotes ? <p>{latestReview.husbandImprovementNotes}</p> : null}<p>{formatCookedAt(latestReview.cookedAt)}</p></div> : <p>还没有复盘记录</p>}</section>
      {recipe.tips ? <section className="recipe-detail-v3-tips"><h2>小贴士</h2><p>{recipe.tips}</p></section> : null}
    </section>

    <footer className={`recipe-detail-v3-footer ${onStartCooking ? "" : "is-single-action"}`}><Button variant="outline" data-press-feedback="apple" onClick={() => setReviewOpen(true)}>查看复盘</Button>{onStartCooking ? <Button data-press-feedback="apple" onClick={() => onStartCooking(recipe.id)}>开始做菜</Button> : null}</footer>
    {notice ? <p className="recipe-detail-v3-notice" role="status">{notice}</p> : null}
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这道菜谱？</AlertDialogTitle><AlertDialogDescription>删除后无法恢复，相关图片和复盘记录也会一并删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-press-feedback="apple">取消</AlertDialogCancel><AlertDialogAction data-press-feedback="apple" onClick={() => void deleteRecipe()}>删除菜谱</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <CookingLogSheet open={reviewOpen} onClose={() => setReviewOpen(false)} onSubmit={async (input) => { await addCookingLogApi(id, input); setReviewOpen(false); setNotice("已保存复盘"); await load(); }} />
  </main>;
}
