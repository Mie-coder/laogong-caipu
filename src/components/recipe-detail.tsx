"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock3, Ellipsis, FileText, Pencil, Star, Trash2 } from "lucide-react";
import { addCookingLogApi, deleteRecipeApi, getRecipeApi } from "@/lib/http/api-client";
import { CookingLogSheet } from "@/components/cooking-log-sheet";
import { DifficultyStars } from "@/components/difficulty-stars";
import { ImageCarousel } from "@/components/image-carousel";
import { SkeletonCard } from "@/components/skeleton-card";
import { Toast } from "@/components/toast";

const LIST_RETURN_KEY = "recipe-list-return";

function formatCookedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function RecipeDetail({ id }: { id: number }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps">("ingredients");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      setError("");
      const result = await getRecipeApi(id);
      setRecipe(result.recipe);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const detailImages = useMemo(() => {
    if (!recipe) return [];
    if (recipe.imageUrls?.length) return recipe.imageUrls;
    return recipe.coverImageUrl ? [recipe.coverImageUrl] : [];
  }, [recipe]);

  const prepItems = useMemo(() => {
    if (!recipe) return [];
    return [...recipe.ingredients, ...recipe.seasonings].filter((item) => item?.name);
  }, [recipe]);

  function toggleChecked(name: string) {
    setCheckedItems((current) => ({ ...current, [name]: !current[name] }));
  }

  function handleBack() {
    try {
      const raw = window.sessionStorage.getItem(LIST_RETURN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { url?: string };
        if (parsed.url) {
          router.push(parsed.url);
          return;
        }
      }
    } catch {
      // ponytail: bad sessionStorage falls back to the default list route
    }

    router.push("/recipes");
  }

  async function handleDelete() {
    if (!window.confirm("确认删除这道菜谱吗？")) return;
    try {
      await deleteRecipeApi(id);
      setMenuOpen(false);
      router.push("/recipes");
    } catch (deleteError) {
      setToast(deleteError instanceof Error ? deleteError.message : "删除失败");
      setMenuOpen(false);
    }
  }

  if (!recipe && !error) {
    return <SkeletonCard />;
  }

  if (error) {
    return (
      <div className="space-y-6 px-5 pb-32 pt-6 text-ink">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="返回菜谱列表"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center"
            onClick={handleBack}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          <h1 className="text-[30px] font-bold leading-tight text-ink">菜谱没找到</h1>
          <p className="text-[16px] text-muted">{error}</p>
          <button
            type="button"
            className="min-h-[44px] text-[16px] font-semibold text-ink underline underline-offset-4"
            onClick={() => void load()}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const latestLog = recipe.cookingLogs?.[0] ?? null;

  return (
    <>
      <div className="bg-bg pb-36 text-ink">
        <section className="relative">
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pb-4 pt-5 text-white">
            <button
              type="button"
              aria-label="返回菜谱列表"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center"
              onClick={handleBack}
            >
              <ChevronLeft className="h-7 w-7" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="菜谱信息"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center"
              >
                <Pencil className="h-6 w-6" aria-hidden="true" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  aria-label="更多操作"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center"
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  <Ellipsis className="h-6 w-6" aria-hidden="true" />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[52px] min-w-[132px] rounded-[8px] border border-line bg-white p-1 text-ink"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-[6px] px-3 text-left text-[16px]"
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      删除菜谱
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {detailImages.length > 0 ? (
            <ImageCarousel images={detailImages} />
          ) : (
            <div className="aspect-[4/3] bg-white" />
          )}
        </section>

        <section className="space-y-6 px-5 pt-6">
          <div className="space-y-3">
            <h1 className="text-[28px] font-bold leading-[1.3] text-ink">{recipe.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
              <span>{recipe.mainCategory}</span>
              <span>•</span>
              <DifficultyStars difficulty={recipe.difficulty} />
              {recipe.cookTimeMinutes ? (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {recipe.cookTimeMinutes} 分钟
                  </span>
                </>
              ) : null}
              <span>•</span>
              <span>做过 {recipe.cookedCount} 次</span>
            </div>
            {latestLog?.wifeRating ? (
              <p className="text-[17px] text-ink">
                老婆评分 <span className="text-accent">{latestLog.wifeRating.toFixed(1)}</span>
              </p>
            ) : null}
          </div>

          <div className="border-b border-line">
            <div className="grid grid-cols-2">
              <button
                type="button"
                aria-label="备料"
                className={`relative min-h-[52px] text-center text-[17px] ${activeTab === "ingredients" ? "font-semibold text-ink" : "text-muted"}`}
                onClick={() => setActiveTab("ingredients")}
              >
                备料
                {activeTab === "ingredients" ? <span className="absolute bottom-0 left-1/2 h-[2px] w-16 -translate-x-1/2 bg-accent" /> : null}
              </button>
              <button
                type="button"
                aria-label="步骤"
                className={`relative min-h-[52px] text-center text-[17px] ${activeTab === "steps" ? "font-semibold text-ink" : "text-muted"}`}
                onClick={() => setActiveTab("steps")}
              >
                步骤
                {activeTab === "steps" ? <span className="absolute bottom-0 left-1/2 h-[2px] w-16 -translate-x-1/2 bg-accent" /> : null}
              </button>
            </div>
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-ink">食材与调料</h2>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center gap-1 text-[16px] text-muted"
                onClick={() => setActiveTab("ingredients")}
              >
                做菜模式
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="border-t border-line">
              {prepItems.map((item: { name: string; amount: string }, index: number) => {
                const checked = Boolean(checkedItems[item.name]);
                return (
                  <li key={`${item.name}-${index}`} className="border-b border-line">
                    <label className="flex min-h-[78px] items-center gap-4">
                      <input
                        type="checkbox"
                        aria-label={`勾选食材 ${item.name}`}
                        className="h-10 w-10 rounded-full border border-muted accent-accent"
                        checked={checked}
                        onChange={() => toggleChecked(item.name)}
                      />
                      <span className={`flex-1 text-[17px] ${checked ? "text-subtle line-through" : "text-ink"}`}>{item.name}</span>
                      <span className="text-[17px] text-ink">{item.amount || "适量"}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-6">
            <h2 className="text-[20px] font-semibold text-ink">制作步骤</h2>
            <ol className="space-y-8">
              {recipe.steps.map((step: { order: number; text: string; imageUrl: string | null }) => (
                <li key={step.order} className="space-y-4">
                  <div className="flex gap-5">
                    <span className="min-w-[56px] text-[48px] italic leading-none text-ink">
                      {String(step.order).padStart(2, "0")}
                    </span>
                    <p className="pt-2 text-[17px] leading-[1.65] text-ink">{step.text}</p>
                  </div>
                  {step.imageUrl ? (
                    <img
                      src={step.imageUrl}
                      alt=""
                      className="h-auto w-full rounded-[6px] object-cover"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          {latestLog ? (
            <section className="space-y-4 border-t border-line pt-6">
              <h2 className="text-[20px] font-semibold text-ink">最近复盘</h2>
              <div className="space-y-3 text-[16px] text-ink">
                {latestLog.wifeRating ? (
                  <p className="inline-flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent" fill="currentColor" aria-hidden="true" />
                    {latestLog.wifeRating.toFixed(1)}
                  </p>
                ) : null}
                {latestLog.wifeFeedback ? <p>{latestLog.wifeFeedback}</p> : null}
                {latestLog.husbandImprovementNotes ? <p className="text-muted">{latestLog.husbandImprovementNotes}</p> : null}
                {latestLog.cookedAt ? <p className="text-sm text-subtle">{formatCookedAt(latestLog.cookedAt)}</p> : null}
              </div>
            </section>
          ) : null}

          {recipe.tips ? (
            <section className="space-y-3 border-t border-line pt-6">
              <h2 className="text-[20px] font-semibold text-ink">小贴士</h2>
              <p className="text-[16px] leading-[1.65] text-muted">{recipe.tips}</p>
            </section>
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[430px] items-center gap-4 px-5 pb-[calc(var(--safe-bottom)+12px)] pt-4">
          <button
            type="button"
            className="inline-flex min-h-[48px] items-center gap-3 text-[17px] text-ink"
            onClick={() => setActiveTab("steps")}
          >
            <FileText className="h-6 w-6" aria-hidden="true" />
            查看复盘
          </button>
          <button
            type="button"
            className="ml-auto min-h-[48px] min-w-[168px] rounded-[8px] bg-ink px-6 text-[17px] font-semibold text-white"
            onClick={() => setSheetOpen(true)}
          >
            标记做过
          </button>
        </div>
      </div>

      <CookingLogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={async (input) => {
          await addCookingLogApi(id, input);
          setToast("已保存复盘");
          setSheetOpen(false);
          await load();
        }}
      />
      <Toast message={toast} />
    </>
  );
}
