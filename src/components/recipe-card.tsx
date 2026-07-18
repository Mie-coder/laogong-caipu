"use client";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeSummary } from "@/lib/domain/recipe-api";
export type RecipeCardSummary = RecipeSummary;

function meta(recipe: RecipeSummary) {
  const time = recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} 分钟` : "时间未定";
  const activity = recipe.wifeRating > 0 ? `老婆评分 ${recipe.wifeRating.toFixed(1)}` : `做过 ${recipe.cookedCount} 次`;
  return `${time} · ${activity}`;
}

export function RecipeCard({ recipe, fallbackImageUrl, onOpen = () => undefined, selected, onSelect, variant = "list" }: { recipe: RecipeSummary; fallbackImageUrl?: string; onOpen?: () => void; selected?: boolean; onSelect?: () => void; variant?: "list" | "default"; disableLink?: boolean; showChevron?: boolean }) {
  const details = meta(recipe);
  return <article className={`v3-recipe-row ${variant === "default" ? "v3-recipe-default" : ""}`}>
    <div className="v3-recipe-image">{recipe.coverImageUrl || fallbackImageUrl ? <img src={recipe.coverImageUrl ?? fallbackImageUrl} alt="" /> : <span className="v3-no-image"><ImageIcon aria-hidden="true" />无图</span>}</div>
    <div className="min-w-0 flex-1"><h2>{recipe.name}</h2><p className="v3-recipe-meta">{details}</p></div>
    {onSelect ? <Button variant="ghost" size="icon" aria-label={`选择菜谱 ${recipe.name}`} aria-pressed={selected} onClick={onSelect}>{selected ? "已选" : "选择"}</Button> : <Button variant="ghost" size="icon" aria-label={`查看菜谱 ${recipe.name}`} onClick={onOpen}><ChevronRight aria-hidden="true" /></Button>}
  </article>;
}
