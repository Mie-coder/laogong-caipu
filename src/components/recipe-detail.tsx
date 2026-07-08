"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Ellipsis, FileText, PencilLine, Star, Trash2 } from "lucide-react";
import { addCookingLogApi, deleteRecipeApi, getRecipeApi } from "@/lib/http/api-client";
import { CookingLogSheet } from "@/components/cooking-log-sheet";
import { DIFFICULTY_LABELS } from "@/components/difficulty-stars";
import { ImageCarousel } from "@/components/image-carousel";
import { SkeletonCard } from "@/components/skeleton-card";
import { Toast } from "@/components/toast";

const LIST_RETURN_KEY = "recipe-list-return";

function formatCookedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatCookTime(minutes?: number | null) {
  return minutes ? `${minutes} 分钟` : "时间未定";
}

function formatDetailMetadata(recipe: any) {
  const difficulty = DIFFICULTY_LABELS[recipe.difficulty] ?? "未知";
  return [recipe.mainCategory, difficulty, formatCookTime(recipe.cookTimeMinutes), `做过 ${recipe.cookedCount} 次`]
    .filter(Boolean)
    .join(" · ");
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
  const ingredientsRef = useRef<HTMLElement | null>(null);
  const stepsRef = useRef<HTMLElement | null>(null);
  const reviewRef = useRef<HTMLElement | null>(null);

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
    router.push(getListReturnUrl());
  }

  function getListReturnUrl() {
    try {
      const raw = window.sessionStorage.getItem(LIST_RETURN_KEY);
      if (!raw) return "/recipes";
      const parsed = JSON.parse(raw) as { url?: string };
      return parsed.url || "/recipes";
    } catch {
      // ponytail: bad sessionStorage falls back to the default list route
      return "/recipes";
    }
  }

  function scrollToSection(section: "ingredients" | "steps" | "review") {
    setActiveTab(section === "steps" ? "steps" : "ingredients");
    const element =
      section === "ingredients" ? ingredientsRef.current : section === "steps" ? stepsRef.current : reviewRef.current;
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleDelete() {
    if (!window.confirm("确认删除这道菜谱吗？")) return;
    try {
      await deleteRecipeApi(id);
      setMenuOpen(false);
      router.push(getListReturnUrl());
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
  const displayRating = recipe.wifeRating > 0 ? recipe.wifeRating : latestLog?.wifeRating;

  return (
    <>
      <div className="recipe-detail-page">
        <section className="recipe-detail-hero-section">
          <div
            className={`recipe-detail-topbar ${detailImages.length ? "is-on-image text-white" : "is-on-empty text-ink"}`}
          >
            <button
              type="button"
              aria-label="返回菜谱列表"
              className="recipe-detail-back-button"
              onClick={handleBack}
            >
              <ChevronLeft className="recipe-detail-top-icon" aria-hidden="true" />
            </button>
            <div className="recipe-detail-top-actions">
              <button
                type="button"
                aria-label="编辑菜谱"
                className="recipe-detail-edit-button"
                onClick={() => setToast("编辑功能后续开放")}
              >
                <PencilLine className="recipe-detail-edit-icon" aria-hidden="true" />
              </button>
              <div className="recipe-detail-menu">
                <button
                  type="button"
                  aria-label="更多操作"
                  className="recipe-detail-more-button"
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  <Ellipsis className="recipe-detail-more-icon" aria-hidden="true" />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="recipe-detail-more-menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="recipe-detail-delete-button"
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="recipe-detail-delete-icon" aria-hidden="true" />
                      删除菜谱
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {detailImages.length > 0 ? (
            <ImageCarousel images={detailImages} variant="detailHero" />
          ) : (
            <div className="recipe-detail-hero recipe-detail-hero-empty" />
          )}
        </section>

        <section className="recipe-detail-content">
          <section className="recipe-detail-summary">
            <h1 className="recipe-detail-title">{recipe.name}</h1>
            <p className="recipe-detail-meta">{formatDetailMetadata(recipe)}</p>
            <span className="sr-only">{`做过 ${recipe.cookedCount} 次`}</span>
            {displayRating ? (
              <p className="recipe-detail-rating">
                <span>老婆评分</span>
                <span className="recipe-detail-rating-value">{displayRating.toFixed(1)}</span>
              </p>
            ) : null}
          </section>

          <div className="recipe-detail-tabs">
            <div className="recipe-detail-tab-grid">
              <button
                type="button"
                aria-label="备料"
                className={`recipe-detail-tab ${activeTab === "ingredients" ? "is-active" : ""}`}
                onClick={() => scrollToSection("ingredients")}
              >
                备料
              </button>
              <button
                type="button"
                aria-label="步骤"
                className={`recipe-detail-tab ${activeTab === "steps" ? "is-active" : ""}`}
                onClick={() => scrollToSection("steps")}
              >
                步骤
              </button>
            </div>
          </div>

          <section ref={ingredientsRef} className="recipe-detail-ingredients">
            <div className="recipe-detail-section-header">
              <h2 className="recipe-detail-section-title">食材与调料</h2>
              <button
                type="button"
                className="recipe-detail-cook-mode"
                onClick={() => scrollToSection("ingredients")}
              >
                做菜模式
                <ChevronRight className="recipe-detail-cook-mode-icon" aria-hidden="true" />
              </button>
            </div>
            <ul className="recipe-detail-prep-list">
              {prepItems.map((item: { name: string; amount: string }, index: number) => {
                const checked = Boolean(checkedItems[item.name]);
                return (
                  <li key={`${item.name}-${index}`} className="recipe-detail-prep-row">
                    <label className="recipe-detail-prep-label">
                      <input
                        type="checkbox"
                        aria-label={`勾选食材 ${item.name}`}
                        className="recipe-detail-prep-checkbox"
                        checked={checked}
                        onChange={() => toggleChecked(item.name)}
                      />
                      <span className={`recipe-detail-prep-name ${checked ? "is-checked" : ""}`}>{item.name}</span>
                      <span className="recipe-detail-prep-amount">{item.amount || "适量"}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section ref={stepsRef} className="recipe-detail-steps">
            <h2 className="recipe-detail-section-title">制作步骤</h2>
            <ol className="recipe-detail-step-list">
              {recipe.steps.map((step: { order: number; text: string; imageUrl: string | null }) => (
                <li key={step.order} className="recipe-detail-step">
                  <div className="recipe-detail-step-copy">
                    <span className="recipe-detail-step-number">
                      {String(step.order).padStart(2, "0")}
                    </span>
                    <p className="recipe-detail-step-text">{step.text}</p>
                  </div>
                  {step.imageUrl ? (
                    <img
                      src={step.imageUrl}
                      alt=""
                      className="recipe-detail-step-image"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          {latestLog ? (
            <section ref={reviewRef} className="recipe-detail-review">
              <h2 className="recipe-detail-section-title">最近复盘</h2>
              <div className="recipe-detail-review-body">
                {latestLog.wifeRating ? (
                  <p className="recipe-detail-review-rating">
                    <Star className="recipe-detail-review-star" fill="currentColor" aria-hidden="true" />
                    {latestLog.wifeRating.toFixed(1)}
                  </p>
                ) : null}
                {latestLog.wifeFeedback ? <p>{latestLog.wifeFeedback}</p> : null}
                {latestLog.husbandImprovementNotes ? <p className="recipe-detail-review-muted">{latestLog.husbandImprovementNotes}</p> : null}
                {latestLog.notes ? <p className="recipe-detail-review-muted">{latestLog.notes}</p> : null}
                {latestLog.cookedAt ? <p className="recipe-detail-review-date">{formatCookedAt(latestLog.cookedAt)}</p> : null}
              </div>
            </section>
          ) : (
            <section ref={reviewRef} className="recipe-detail-review">
              <h2 className="recipe-detail-section-title">最近复盘</h2>
            </section>
          )}

          {recipe.tips ? (
            <section className="recipe-detail-tips">
              <h2 className="recipe-detail-section-title">小贴士</h2>
              <p className="recipe-detail-tips-text">{recipe.tips}</p>
            </section>
          ) : null}
        </section>
      </div>

      <div className="recipe-detail-action-bar">
        <div className="recipe-detail-action-inner">
          <button
            type="button"
            className="recipe-detail-review-button"
            onClick={() => scrollToSection("review")}
          >
            <FileText className="recipe-detail-review-button-icon" aria-hidden="true" />
            查看复盘
          </button>
          <button
            type="button"
            className="recipe-detail-cooked-button"
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
