"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeDetail } from "@/lib/domain/recipe-api";
import { requestIngredientImageApi } from "@/lib/http/api-client";

type IngredientItem = {
  ingredient: RecipeDetail["ingredients"][number];
  kind: "ingredient" | "seasoning";
  index: number;
};

function IngredientVisual({ ingredient, recipeId, kind, index, checked, railRef }: IngredientItem & { recipeId: number; checked: boolean; railRef: RefObject<HTMLDivElement> }) {
  const cardRef = useRef<HTMLSpanElement>(null);
  const requestedRef = useRef(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let controller: AbortController | null = null;

    const load = () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      controller = new AbortController();
      void requestIngredientImageApi(recipeId, kind, index, controller.signal)
        .then(({ imageUrl: nextImageUrl }) => { if (!cancelled) setImageUrl(nextImageUrl); })
        .catch(() => { /* A fallback avatar keeps cooking usable when generation fails. */ });
    };

    const card = cardRef.current;
    const rail = railRef.current;
    if (!card || !rail || typeof IntersectionObserver === "undefined") {
      load();
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          load();
        }
      }, { root: rail, rootMargin: "0px 96px" });
      observer.observe(card);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      controller?.abort();
    };
  }, [index, kind, railRef, recipeId]);

  return <span ref={cardRef} className={`cooking-ingredient-avatar ${imageUrl ? "has-image" : ""}`}><span className="cooking-ingredient-fallback" aria-hidden="true">{ingredient.name.slice(0, 1)}</span>{imageUrl ? <img data-testid={`ingredient-image-${kind}-${index}`} src={imageUrl} alt="" aria-hidden="true" /> : null}{checked ? <span className="cooking-ingredient-ready"><Check aria-hidden="true" /></span> : null}</span>;
}

export function IngredientRail({ recipe }: { recipe: RecipeDetail }) {
  const ingredients: IngredientItem[] = [
    ...recipe.ingredients.map((ingredient, index) => ({ ingredient, kind: "ingredient" as const, index })),
    ...recipe.seasonings.map((ingredient, index) => ({ ingredient, kind: "seasoning" as const, index }))
  ];
  const [ready, setReady] = useState<number[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  return <section className="cooking-ingredients" aria-labelledby="cooking-ingredients-title"><div className="cooking-section-heading"><h2 id="cooking-ingredients-title">备料</h2><Button variant="ghost" size="sm" data-press-feedback="apple" onClick={() => setReady(ingredients.map((_, index) => index))}>全部勾选</Button></div><div ref={railRef} className="cooking-ingredient-rail">{ingredients.map(({ ingredient, kind, index }, railIndex) => { const checked = ready.includes(railIndex); return <Button key={`${kind}-${index}`} variant="ghost" className="cooking-ingredient" aria-pressed={checked} data-press-feedback="apple" onClick={() => setReady((current) => checked ? current.filter((item) => item !== railIndex) : [...current, railIndex])}><IngredientVisual ingredient={ingredient} recipeId={recipe.id} kind={kind} index={index} checked={checked} railRef={railRef} /><strong>{ingredient.name}</strong><small>{ingredient.amount}</small></Button>; })}</div></section>;
}
