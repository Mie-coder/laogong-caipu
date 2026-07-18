"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeDetail } from "@/lib/domain/recipe-api";

export function IngredientRail({ recipe }: { recipe: RecipeDetail }) {
  const ingredients = [...recipe.ingredients, ...recipe.seasonings];
  const [ready, setReady] = useState<number[]>([]);
  return <section className="cooking-ingredients" aria-labelledby="cooking-ingredients-title"><div className="cooking-section-heading"><h2 id="cooking-ingredients-title">备料</h2><Button variant="ghost" size="sm" data-press-feedback="apple" onClick={() => setReady(ingredients.map((_, index) => index))}>全部勾选</Button></div><div className="cooking-ingredient-rail">{ingredients.map((ingredient, index) => { const checked = ready.includes(index); return <Button key={`${ingredient.name}-${index}`} variant="ghost" className="cooking-ingredient" aria-pressed={checked} data-press-feedback="apple" onClick={() => setReady((current) => checked ? current.filter((item) => item !== index) : [...current, index])}><span className="cooking-ingredient-avatar">{checked ? <Check aria-hidden="true" /> : ingredient.name.slice(0, 1)}</span><strong>{ingredient.name}</strong><small>{ingredient.amount}</small></Button>; })}</div></section>;
}
