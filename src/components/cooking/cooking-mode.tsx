"use client";

import { ChevronLeft, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CookingLogSheet } from "@/components/cooking-log-sheet";
import { FavoriteButton } from "@/components/recipe/favorite-button";
import { IngredientRail } from "@/components/cooking/ingredient-rail";
import { StepTimeline } from "@/components/cooking/step-timeline";
import { CookingTimer } from "@/components/cooking/cooking-timer";
import { useCookingSession } from "@/hooks/use-cooking-session";
import { useSpeechNarration } from "@/hooks/use-speech-narration";
import { addCookingLogApi, getRecipeApi } from "@/lib/http/api-client";
import type { RecipeDetail } from "@/lib/domain/recipe-api";

export function CookingMode({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState("");

  async function load() { try { const result = await getRecipeApi(recipeId); setRecipe(result.recipe); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败，请重试"); } }
  useEffect(() => { void load(); }, [recipeId]);

  if (error) return <main className="cooking-mode-error"><Button variant="ghost" size="icon" aria-label="返回菜谱详情" onClick={() => router.push(`/recipes/${recipeId}`)}><ChevronLeft aria-hidden="true" /></Button><h1>加载失败</h1><p role="status">{error}</p><Button onClick={() => void load()}>重试</Button></main>;
  if (!recipe) return <main className="cooking-mode-loading" role="status">加载做菜指引中…</main>;
  return <CookingModeSession recipe={recipe} onRecipeChange={setRecipe} onRefresh={load} />;
}

function CookingModeSession({ recipe, onRecipeChange, onRefresh }: { recipe: RecipeDetail; onRecipeChange: (recipe: RecipeDetail) => void; onRefresh: () => Promise<void> }) {
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false);
  const session = useCookingSession(recipe.id, recipe.steps.map((step) => step.order));
  const speech = useSpeechNarration();
  useEffect(() => () => speech.cancel(), [speech.cancel]);
  const validOrders = recipe.steps.map((step) => step.order);
  const completed = [...new Set(session.state.completedStepOrders.filter((order) => validOrders.includes(order)))];
  return <main className="cooking-mode" data-transaction-screen="true"><header className="cooking-mode-header"><Button variant="secondary" size="icon" aria-label="返回菜谱详情" data-press-feedback="apple" onClick={() => router.push(`/recipes/${recipe.id}`)}><ChevronLeft aria-hidden="true" /></Button><h1>{recipe.name}</h1><div><FavoriteButton recipeId={recipe.id} recipeName={recipe.name} isFavorite={recipe.isFavorite} onChanged={(isFavorite) => onRecipeChange({ ...recipe, isFavorite })} /></div></header><IngredientRail recipe={recipe} /><section className="cooking-speech"><Button variant={session.state.speechEnabled ? "secondary" : "outline"} aria-pressed={session.state.speechEnabled} data-press-feedback="apple" disabled={!speech.supported} onClick={() => { session.setSpeechEnabled(!session.state.speechEnabled); speech.cancel(); }}><Volume2 aria-hidden="true" />{session.state.speechEnabled ? "语音播报已开启" : "开启语音播报"}</Button>{!speech.supported ? <span role="status">当前浏览器不支持语音播报</span> : null}</section><StepTimeline recipe={recipe} currentStepOrder={session.state.currentStepOrder} completedStepOrders={completed} speechEnabled={session.state.speechEnabled && speech.supported} onToggleStep={(order) => { speech.cancel(); session.toggleStep(order); }} onSpeak={speech.speak} /><footer className="cooking-mode-footer"><CookingTimer timer={session.state.timer} onChange={session.setTimer} /><Button className="cooking-finish" data-press-feedback="apple" disabled={recipe.steps.length > 0 && completed.length !== validOrders.length} onClick={() => { speech.cancel(); setReviewOpen(true); }}>完成做菜</Button></footer><CookingLogSheet open={reviewOpen} onClose={() => setReviewOpen(false)} onSubmit={async (input) => { await addCookingLogApi(recipe.id, input); setReviewOpen(false); session.reset(); await onRefresh(); }} /></main>;
}
