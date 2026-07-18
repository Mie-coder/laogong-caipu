"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save } from "lucide-react";
import type { RecipeDraft } from "@/lib/domain/recipe";
import type { RecipeSummary } from "@/lib/domain/recipe-api";
import { filterImages, listRecipesApi, parseImportApi, saveRecipeWithImages } from "@/lib/http/api-client";
import { Button } from "@/components/ui/button";
import { HomeScreen } from "@/components/home/home-screen";
import { ImportSheet } from "@/components/import/import-sheet";
import { ImageReviewScreen } from "@/components/import/image-review-screen";
import { importFlowReducer, initialImportFlowState, type ImportFlowState } from "@/components/import/import-flow-machine";
import { ParsingProgress } from "@/components/import/parsing-progress";
import { RecipeConfirmForm } from "@/components/recipe-confirm-form";

const STORAGE_KEY = "import-flow-draft";
const emptyDraft = (): RecipeDraft => ({ name: "", mainCategory: "未分类", tags: [], ingredients: [], seasonings: [], steps: [{ order: 1, text: "" }], cookTimeMinutes: null, difficulty: "unknown", tips: "", confidence: 0.5, missingFields: [], coverImageUrl: null, imageUrls: [] });
const validSteps = (draft: RecipeDraft) => draft.steps.some((step) => step.text.trim());
const normalized = (draft: RecipeDraft) => ({ ...draft, steps: draft.steps.map((step, index) => ({ ...step, order: index + 1 })) });

export function ImportFlow(): JSX.Element {
  const router = useRouter();
  const controllerRef = useRef<AbortController | null>(null);
  const [state, dispatch] = useReducer(importFlowReducer, initialImportFlowState);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recent, setRecent] = useState<{ loading: boolean; error: string; recipes: RecipeSummary[] }>({ loading: true, error: "", recipes: [] });
  const [validation, setValidation] = useState({ name: "", steps: "" });

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => { try { const saved = window.sessionStorage.getItem(STORAGE_KEY); if (saved) dispatch({ type: "DRAFT_RESTORED", state: JSON.parse(saved) as ImportFlowState }); } catch { window.sessionStorage.removeItem(STORAGE_KEY); } }, []);
  useEffect(() => { let active = true; void listRecipesApi().then((result) => { if (active) setRecent({ loading: false, error: "", recipes: result.recipes.filter((recipe) => recipe.cookedCount > 0).slice(0, 2) }); }).catch((error: unknown) => { if (active) setRecent({ loading: false, error: error instanceof Error ? error.message : "最近做过加载失败", recipes: [] }); }); return () => { active = false; }; }, []);
  useEffect(() => { if (state.stage !== "recipeConfirm" || !state.dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [state.dirty, state.stage]);

  const openSheet = () => { setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);
  const paste = async () => { try { dispatch({ type: "INPUT_CHANGED", rawInput: await navigator.clipboard.readText() }); } catch { dispatch({ type: "PARSE_FAILED", message: "无法读取剪贴板，请手动粘贴" }); setSheetOpen(true); } };
  const startParse = async () => {
    if (!state.rawInput.trim()) return;
    controllerRef.current?.abort(); const controller = new AbortController(); controllerRef.current = controller;
    setSheetOpen(false); dispatch({ type: "PARSE_STARTED" });
    try {
      const parsed = await parseImportApi({ rawInput: state.rawInput.trim() }, controller.signal); if (controller.signal.aborted) return;
      dispatch({ type: "PARSE_STEP_CHANGED", step: 1 }); const draft = normalized(parsed.recipe ?? emptyDraft());
      dispatch({ type: "PARSE_STEP_CHANGED", step: 2 }); let selected = parsed.imageUrls;
      try { selected = parsed.imageUrls.length ? await filterImages(parsed.imageUrls, draft.name, controller.signal) : []; } catch { selected = parsed.imageUrls; }
      if (controller.signal.aborted) return; dispatch({ type: "PARSE_SUCCEEDED", draft, imageUrls: parsed.imageUrls, selectedUrls: selected });
    } catch (error) { if (!controller.signal.aborted) { dispatch({ type: "PARSE_FAILED", message: error instanceof Error ? error.message : "解析失败" }); setSheetOpen(true); } }
  };
  const cancel = () => { controllerRef.current?.abort(); dispatch({ type: "PARSE_CANCELLED" }); setSheetOpen(true); };
  const saveDraft = () => { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); };
  const save = async () => { if (!state.draft) return; const draft = normalized(state.draft); const name = draft.name.trim() ? "" : "请填写菜名"; const steps = validSteps(draft) ? "" : "请至少填写一个步骤"; setValidation({ name, steps }); if (name || steps) return; dispatch({ type: "SAVE_STARTED" }); try { const result = await saveRecipeWithImages({ ...draft, coverImageUrl: state.coverUrl }, state.selectedUrls); window.sessionStorage.removeItem(STORAGE_KEY); dispatch({ type: "RESET" }); router.push(`/recipes/${result.id}`); } catch (error) { dispatch({ type: "SAVE_FAILED", message: error instanceof Error ? error.message : "保存失败" }); } };
  if (state.stage === "parsing") return <ParsingProgress step={state.parsingStep} source={state.rawInput} onCancel={cancel} />;
  if (state.stage === "imageReview") return <ImageReviewScreen urls={state.reviewUrls} selectedUrls={state.selectedUrls} coverUrl={state.coverUrl} onBack={() => { dispatch({ type: "REVIEW_BACK" }); setSheetOpen(true); }} onToggle={(url) => dispatch({ type: "IMAGE_TOGGLED", url })} onCover={(url) => dispatch({ type: "COVER_SELECTED", url })} onConfirm={(withoutImages) => dispatch({ type: "CONFIRM_OPENED", withoutImages })} />;
  if ((state.stage === "recipeConfirm" || state.stage === "saving") && state.draft) return <main data-testid="recipe-confirm-page" className="recipe-confirm-page mx-auto min-h-dvh max-w-[430px] pb-32"><header className="flex items-center justify-between px-5 pb-5 pt-10"><Button variant="ghost" size="icon" aria-label="返回图片审核" onClick={() => dispatch({ type: "PARSE_SUCCEEDED", draft: state.draft!, imageUrls: state.reviewUrls, selectedUrls: state.selectedUrls })}><ChevronLeft /></Button><h1 className="text-2xl font-bold">确认菜谱</h1><Button variant="ghost" size="icon" aria-label="保存草稿" onClick={saveDraft}><Save /></Button></header><div className="px-5"><RecipeConfirmForm draft={state.draft} imageUrls={state.selectedUrls} coverUrl={state.coverUrl} nameError={validation.name} stepsError={validation.steps} onChange={(draft) => dispatch({ type: "DRAFT_CHANGED", draft })} /></div><footer className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t bg-background/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">{state.error ? <p role="alert" className="mb-2 text-sm text-destructive">{state.error}</p> : null}<Button className="w-full" disabled={state.stage === "saving"} onClick={() => void save()}>保存菜谱</Button></footer></main>;
  return <><HomeScreen recent={recent.loading ? { status: "loading" } : recent.error ? { status: "error", message: recent.error } : { status: "ready", data: recent.recipes }} onImport={openSheet} onRetry={() => window.location.reload()} /><ImportSheet open={sheetOpen} rawInput={state.rawInput} error={state.error} onOpenChange={(open) => { setSheetOpen(open); if (open) dispatch({ type: "INPUT_CHANGED", rawInput: state.rawInput }); }} onInputChange={(rawInput) => dispatch({ type: "INPUT_CHANGED", rawInput })} onPaste={() => void paste()} onSubmit={() => void startParse()} /></>;
}
