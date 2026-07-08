"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Cloud,
  Clipboard,
  Clock3,
  Ellipsis,
  Image as ImageIcon,
  LoaderCircle,
  Sparkles
} from "lucide-react";
import { RecipeDraft } from "@/lib/domain/recipe";
import { filterImages, listRecipesApi, parseImportApi, saveRecipeWithImages } from "@/lib/http/api-client";
import { BottomSheet } from "@/components/bottom-sheet";
import { ImageCarousel } from "@/components/image-carousel";
import { RecipeConfirmForm } from "@/components/recipe-confirm-form";
import { Toast } from "@/components/toast";

type Stage = "home" | "parsing" | "images" | "confirm";

type RecipeListItem = {
  id: number;
  name: string;
  cookedCount: number;
  cookTimeMinutes?: number | null;
  difficulty?: string;
  mainCategory?: string;
  wifeRating?: number;
  coverImageUrl?: string | null;
};

const STORAGE_KEY = "import-flow-draft";
const PARSING_LABELS = ["识别分享内容", "读取菜谱正文", "整理食材和步骤", "筛选菜谱图片"];
const PARSING_DESCRIPTIONS = ["已找到小红书链接", "已提取食材与做法", "AI 正在核对用量与顺序", ""];
const EXAMPLE = "5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算... http://xhslink.com/o/smiaxnsR3c 复制后打开【小红书】查看笔记！";

function createEmptyDraft(): RecipeDraft {
  return {
    name: "",
    mainCategory: "未分类",
    tags: [],
    ingredients: [],
    seasonings: [],
    steps: [{ order: 1, text: "" }],
    cookTimeMinutes: null,
    difficulty: "unknown",
    tips: "",
    confidence: 0.5,
    missingFields: [],
    coverImageUrl: null,
    imageUrls: []
  };
}

function normalizeSteps(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    steps: draft.steps.map((step, index) => ({
      ...step,
      order: index + 1
    }))
  };
}

function hasValidSteps(draft: RecipeDraft) {
  return draft.steps.some((step) => step.text.trim());
}

function formatRating(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function formatRecentMeta(recipe: RecipeListItem) {
  const parts = [];
  if (recipe.cookTimeMinutes) {
    parts.push(`${recipe.cookTimeMinutes} 分钟`);
  }
  if (recipe.wifeRating && recipe.wifeRating > 0) {
    parts.push(`老婆评分 ${formatRating(recipe.wifeRating)}`);
  } else {
    parts.push(`做过 ${recipe.cookedCount} 次`);
  }
  return parts.join(" · ");
}

function formatParsingSource(rawInput: string, draft?: RecipeDraft | null) {
  if (draft?.name) {
    return `来自小红书 · ${draft.name}`;
  }

  const cleaned = rawInput
    .replace(/https?:\/\/\S+/g, "")
    .replace(/复制后打开【小红书】查看笔记！?/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "来自小红书 · 正在读取分享";
  }

  return cleaned.startsWith("来自小红书") ? cleaned : `来自小红书 · ${cleaned}`;
}

export function ImportFlow(): JSX.Element {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const requestTokenRef = useRef(0);
  const reduceMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>("home");
  const [parsingStep, setParsingStep] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [sheetError, setSheetError] = useState("");
  const [toast, setToast] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [reviewUrls, setReviewUrls] = useState<string[]>([]);
  const [listState, setListState] = useState<{
    loading: boolean;
    error: string;
    recipes: RecipeListItem[];
  }>({ loading: true, error: "", recipes: [] });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [stepsError, setStepsError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasParsedResult, setHasParsedResult] = useState(false);

  useEffect(() => {
    const savedDraft = window.sessionStorage.getItem(STORAGE_KEY);
    if (!savedDraft) return;

    try {
      const payload = JSON.parse(savedDraft) as {
        draft: RecipeDraft;
        selectedUrls: string[];
        coverUrl: string | null;
      };
      setDraft(normalizeSteps(payload.draft));
      setSelectedUrls(payload.selectedUrls ?? []);
      setReviewUrls(payload.selectedUrls ?? []);
      setCoverUrl(payload.coverUrl ?? null);
      setHasParsedResult(true);
      setStage("confirm");
      setHasUnsavedChanges(true);
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentRecipes() {
      setListState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const result = await listRecipesApi();
        if (cancelled) return;
        const recipes = (result.recipes as RecipeListItem[])
          .filter((recipe) => recipe.cookedCount > 0)
          .slice(0, 2);
        setListState({ loading: false, error: "", recipes });
      } catch (error) {
        if (cancelled) return;
        setListState({
          loading: false,
          error: error instanceof Error ? error.message : "最近做过加载失败",
          recipes: []
        });
      }
    }

    void loadRecentRecipes();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stage !== "confirm" || !hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [stage, hasUnsavedChanges]);

  const previewCountLabel = useMemo(
    () => `${selectedUrls.length} / ${reviewUrls.length} 已选`,
    [reviewUrls.length, selectedUrls.length]
  );

  async function loadRecentRecipesAgain() {
    setListState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await listRecipesApi();
      const recipes = (result.recipes as RecipeListItem[])
        .filter((recipe) => recipe.cookedCount > 0)
        .slice(0, 2);
      setListState({ loading: false, error: "", recipes });
    } catch (error) {
      setListState({
        loading: false,
        error: error instanceof Error ? error.message : "最近做过加载失败",
        recipes: []
      });
    }
  }

  function openSheet() {
    setSheetOpen(true);
    setSheetError("");
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  async function handlePaste() {
    setSheetError("");
    try {
      const text = await navigator.clipboard.readText();
      setRawInput((current) => (current ? `${current}\n${text}` : text));
    } catch {
      setSheetError("无法读取剪贴板，请手动粘贴");
      textareaRef.current?.focus();
    }
  }

  async function handleParse() {
    const trimmed = rawInput.trim();
    if (!trimmed || isParsing) return;

    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    setIsParsing(true);
    setSheetOpen(false);
    setSheetError("");
    setStage("parsing");
    setParsingStep(0);
    setSaveError("");
    setHasParsedResult(false);
    await Promise.resolve();

    try {
      const result = await parseImportApi({ rawInput: trimmed });
      if (requestTokenRef.current !== token) return;
      setParsingStep(1);

      const nextDraft = normalizeSteps(result.recipe ?? createEmptyDraft());
      const imageUrls = result.imageUrls ?? [];
      setParsingStep(2);
      const filteredUrls = imageUrls.length > 0 ? await filterImages(imageUrls, nextDraft.name) : [];
      if (requestTokenRef.current !== token) return;
      setParsingStep(3);

      setDraft(nextDraft);
      setReviewUrls(imageUrls);
      setSelectedUrls(filteredUrls);
      setCoverUrl(filteredUrls[0] ?? null);
      setHasParsedResult(true);
      setHasUnsavedChanges(false);
      setStage("images");
    } catch (error) {
      if (requestTokenRef.current !== token) return;
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      setSheetOpen(true);
      setStage("home");
      setSheetError(error instanceof Error ? error.message : "解析失败");
    } finally {
      if (requestTokenRef.current === token) {
        setIsParsing(false);
      }
    }
  }

  function handleCancelParsing() {
    if (!window.confirm("要取消这次解析吗？")) return;
    requestTokenRef.current += 1;
    setIsParsing(false);
    setParsingStep(0);
    setStage("home");
    setSheetOpen(true);
  }

  function handleToggleSelection(url: string) {
    setSelectedUrls((current) => {
      const removing = current.includes(url);
      const next = removing ? current.filter((item) => item !== url) : [...current, url];
      if (removing && coverUrl === url) {
        setCoverUrl(null);
      }
      return next;
    });
  }

  function handleSetCover(url: string) {
    if (!selectedUrls.includes(url)) {
      setSelectedUrls((current) => [...current, url]);
    }
    setCoverUrl(url);
  }

  function goToConfirm(selected = selectedUrls, cover = coverUrl) {
    if (!draft) return;
    setSelectedUrls(selected);
    setCoverUrl(cover);
    setStage("confirm");
    setHasUnsavedChanges(true);
  }

  function handleConfirmImages() {
    goToConfirm();
  }

  function handleReturnToParsedResult() {
    setStage("home");
    setSheetOpen(false);
  }

  function handleSaveDraft() {
    if (!draft) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      draft: normalizeSteps(draft),
      selectedUrls,
      coverUrl
    }));
    setToast("草稿已保存");
    setHasUnsavedChanges(true);
  }

  function handleDraftChange(nextDraft: RecipeDraft) {
    setDraft(normalizeSteps(nextDraft));
    setHasUnsavedChanges(true);
    setNameError(nextDraft.name.trim() ? "" : "请填写菜名");
    setStepsError(hasValidSteps(nextDraft) ? "" : "请至少填写一个步骤");
  }

  async function handleSaveRecipe() {
    if (!draft) return;

    const normalizedDraft = normalizeSteps(draft);
    const nextNameError = normalizedDraft.name.trim() ? "" : "请填写菜名";
    const nextStepsError = hasValidSteps(normalizedDraft) ? "" : "请至少填写一个步骤";
    setNameError(nextNameError);
    setStepsError(nextStepsError);
    setSaveError("");
    if (nextNameError || nextStepsError) return;

    setSaving(true);
    try {
      const saved = await saveRecipeWithImages(
        { ...normalizedDraft, coverImageUrl: coverUrl },
        selectedUrls
      );
      window.sessionStorage.removeItem(STORAGE_KEY);
      setHasUnsavedChanges(false);
      router.push(`/recipes/${saved.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const parsingSummary = formatParsingSource(rawInput, draft);

  return (
    <>
      {stage === "home" && (
        <section data-testid="home-page" className="home-page">
          <header className="home-header">
            <div>
              <h1 className="home-brand-title">老公菜谱</h1>
              <p className="home-brand-subtitle">今晚做什么</p>
            </div>
            <button type="button" aria-label="查看历史" className="home-history-button">
              <Clock3 className="home-history-icon" aria-hidden="true" />
            </button>
          </header>

          <div className="home-hero-frame">
            <img
              src="/ui-concepts/home-hero.png"
              alt="今晚认真做一道菜"
              className="home-hero-image"
            />
          </div>

          <section className="home-promise">
            <h2 className="home-promise-title">今晚认真做一道菜</h2>
            <p className="home-promise-copy">把收藏整理成真正能照着做的步骤</p>
          </section>

          <button
            type="button"
            aria-label="从小红书导入菜谱"
            className="home-import-row"
            onClick={openSheet}
          >
            <span className="home-import-icon" aria-hidden="true">
              <Sparkles />
            </span>
            <span className="home-import-copy">
              <span className="home-import-title">从小红书导入菜谱</span>
              <span className="home-import-subtitle">粘贴分享文字，自动整理食材与步骤</span>
            </span>
            <ArrowRight className="home-import-arrow" aria-hidden="true" />
          </button>

          {hasParsedResult && draft ? (
            <section className="mx-[var(--page-x)] mt-8 space-y-4 border-b border-line pb-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted">解析完成</p>
                <h3 className="text-[24px] font-bold leading-[1.3] text-ink">{draft.name || "已整理好待确认的菜谱"}</h3>
                <p className="text-sm leading-[1.5] text-muted">
                  {[draft.mainCategory, draft.difficulty, `${reviewUrls.length} 张待审核图片`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  className="min-h-12 w-full rounded-[8px] bg-ink px-5 py-3 text-base font-semibold text-white"
                  onClick={() => setStage("images")}
                >
                  继续审核图片
                </button>
                <button type="button" className="text-sm text-ink" onClick={() => goToConfirm()}>
                  直接确认菜谱
                </button>
              </div>
            </section>
          ) : null}

          <section className="home-recent">
            <div className="home-recent-header">
              <h3 className="home-recent-title">最近做过</h3>
              <a href="/recipes" className="home-recent-all">
                查看全部
                <ChevronRight aria-hidden="true" />
              </a>
            </div>

            {listState.loading && (
              <div>
                {[0, 1].map((index) => (
                  <div key={index} className="home-recent-item border-b border-line">
                    <div className="home-recent-thumb bg-[#f1ebe6]" />
                    <div className="min-w-0 space-y-2">
                      <div className="h-4 w-24 rounded bg-[#f1ebe6]" />
                      <div className="h-3 w-40 rounded bg-[#f5efeb]" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!listState.loading && listState.error && (
              <div className="space-y-3 border-b border-line py-4 text-sm text-muted">
                <p>{listState.error}</p>
                <button type="button" className="text-ink underline underline-offset-4" onClick={() => void loadRecentRecipesAgain()}>
                  重试
                </button>
              </div>
            )}

            {!listState.loading && !listState.error && listState.recipes.length === 0 && (
              <div className="space-y-3 border-b border-line py-4 text-sm text-muted">
                <p>还没有做过的菜谱，先导入一道试试。</p>
                <button type="button" className="text-ink underline underline-offset-4" onClick={openSheet}>
                  从小红书导入菜谱
                </button>
              </div>
            )}

            {!listState.loading && !listState.error && listState.recipes.length > 0 && (
              <div>
                {listState.recipes.map((recipe) => (
                  <div key={recipe.id} className="home-recent-item border-b border-line">
                    <div className="home-recent-thumb bg-[#f1ebe6]">
                      {recipe.coverImageUrl ? (
                        <img
                          src={recipe.coverImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-subtle">
                          <ImageIcon className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => router.push(`/recipes/${recipe.id}`)}
                    >
                      <p className="home-recent-name">{recipe.name}</p>
                      <p className="home-recent-meta">
                        {formatRecentMeta(recipe)}
                      </p>
                    </button>
                    <button type="button" aria-label={`更多 ${recipe.name}`} className="home-recent-more">
                      <Ellipsis aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      <BottomSheet open={sheetOpen} title="导入菜谱" onClose={closeSheet}>
        <div className="flex min-h-[58vh] max-h-[72vh] flex-col">
          <div className="space-y-3 pb-4">
            <p className="import-sheet-lead text-[14px] leading-[22px] text-muted">把分享文本贴进来，我会按菜谱结构整理好，图片也会先帮你筛一遍。</p>

            <label className="block">
              <span className="mb-2 block text-[14px] leading-[20px] text-ink">分享文本</span>
              <textarea
                ref={textareaRef}
                aria-label="分享文本"
                className="import-sheet-textarea min-h-[120px] w-full rounded-input border border-line bg-white px-4 py-3 text-[16px] leading-[25px] text-text outline-none placeholder:text-subtle focus:border-ink"
                placeholder={EXAMPLE}
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
              />
            </label>

            <button type="button" className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold leading-[20px] text-ink" onClick={() => void handlePaste()}>
              <Clipboard className="h-[18px] w-[18px]" aria-hidden="true" />
              粘贴分享文本
            </button>

            <p className="import-sheet-hint text-[12px] leading-[17px] text-subtle">支持小红书分享口令、短链和正文片段。关闭抽屉不会清空你已经粘贴的内容。</p>
          </div>

          <div className="mt-auto space-y-3 border-t border-line pb-[calc(var(--safe-bottom)+10px)] pt-4">
            {sheetError ? <p className="import-sheet-error text-sm text-[#d45b5b]">{sheetError}</p> : null}
            <button
              type="button"
              className="import-sheet-submit min-h-[48px] w-full rounded-input bg-ink px-5 py-3 text-[16px] font-semibold text-white disabled:bg-disabled"
              disabled={!rawInput.trim() || isParsing}
              onClick={() => void handleParse()}
            >
              开始智能解析
            </button>
          </div>
        </div>
      </BottomSheet>

      {stage === "parsing" && (
        <section data-testid="import-parsing-page" className="import-parsing-page">
          <header className="import-parsing-header">
            <button type="button" aria-label="返回导入" className="import-parsing-back" onClick={handleCancelParsing}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <h1 className="import-parsing-title">正在整理菜谱</h1>
            <span className="import-parsing-header-spacer" aria-hidden="true" />
          </header>

          <div className="import-parsing-hero">
            <img
              src="/ui-concepts/import-parsing-hero.png"
              alt="正在整理菜谱"
              className="import-parsing-hero-image"
            />
          </div>

          <p className="import-parsing-source">{parsingSummary}</p>

          <ol className="import-parsing-timeline" aria-label="解析进度">
            {PARSING_LABELS.map((label, index) => {
              const isDone = index < parsingStep;
              const isCurrent = index === parsingStep;
              return (
                <li
                  key={label}
                  data-testid="import-parsing-step"
                  className={`import-parsing-step ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`}
                >
                  <span className="import-parsing-step-marker">
                    {isDone ? (
                      <Check className="import-parsing-step-check" aria-hidden="true" />
                    ) : isCurrent ? (
                      <LoaderCircle className={`import-parsing-step-loader ${reduceMotion ? "" : "animate-spin"}`} aria-hidden="true" />
                    ) : (
                      <Circle className="import-parsing-step-circle" aria-hidden="true" />
                    )}
                  </span>
                  <span className="import-parsing-step-copy">
                    <span className="import-parsing-step-title">{label}</span>
                    {PARSING_DESCRIPTIONS[index] ? (
                      <span className="import-parsing-step-description">{PARSING_DESCRIPTIONS[index]}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="import-parsing-hints">
            <p className="import-parsing-hint">
              <Cloud aria-hidden="true" />
              您的输入已自动保存
            </p>
            <p className="import-parsing-hint is-muted">
              <Clock3 aria-hidden="true" />
              通常需要 10-20 秒，请不要关闭页面
            </p>
          </div>

          <button type="button" className="import-parsing-cancel" onClick={handleCancelParsing}>
            取消解析
          </button>
        </section>
      )}

      {stage === "images" && draft && (
        <section data-testid="image-review-page" className="image-review-page">
          <header className="image-review-header">
            <button type="button" aria-label="返回解析结果" className="image-review-back" onClick={handleReturnToParsedResult}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="image-review-heading">
              <span className="sr-only">图片审核</span>
              <h1 className="image-review-title">选择菜谱图片</h1>
              <p className="image-review-subtitle">保留真正有助于做菜的图片</p>
            </div>
            <p className="image-review-count">{previewCountLabel}</p>
          </header>

          <div className="image-review-body">
            <ImageCarousel
              images={reviewUrls}
              selectedUrls={selectedUrls}
              coverUrl={coverUrl}
              onToggleSelection={handleToggleSelection}
              onSetCover={handleSetCover}
              variant="imageReview"
            />
          </div>

          <p className="image-review-note">AI 已推荐 {selectedUrls.length} 张，你可以继续调整</p>

          <div className="image-review-footer fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2">
            <div className="image-review-footer-inner">
              <button type="button" className="image-review-submit" onClick={handleConfirmImages}>
                确认图片（{selectedUrls.length}）
              </button>
              <button type="button" className="image-review-empty" onClick={() => goToConfirm([], null)}>
                无图保存
              </button>
            </div>
          </div>
        </section>
      )}

      {stage === "confirm" && draft && (
        <section data-testid="recipe-confirm-page" className="recipe-confirm-page">
          <header className="recipe-confirm-header">
            <button type="button" aria-label="返回图片审核" className="recipe-confirm-back" onClick={() => setStage("images")}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <h1 className="recipe-confirm-title">确认菜谱</h1>
            <button type="button" className="recipe-confirm-draft-button" onClick={handleSaveDraft}>
              保存草稿
            </button>
          </header>

          <div className="recipe-confirm-body">
            <RecipeConfirmForm
              draft={draft}
              imageUrls={selectedUrls}
              onChange={handleDraftChange}
              coverUrl={coverUrl}
              nameError={nameError}
              stepsError={stepsError}
            />
          </div>

          <div className="recipe-confirm-footer fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2">
            <div className="recipe-confirm-footer-inner">
              {saveError ? <p className="recipe-confirm-error">{saveError}</p> : null}
              <p className="recipe-confirm-save-hint"><span aria-hidden="true">•</span> 请确认食材用量后再保存</p>
              <button
                type="button"
                className="recipe-confirm-submit"
                disabled={saving || !draft.name.trim() || !hasValidSteps(draft)}
                onClick={() => void handleSaveRecipe()}
              >
                保存菜谱
              </button>
            </div>
          </div>
        </section>
      )}

      <Toast message={toast} />
    </>
  );
}
