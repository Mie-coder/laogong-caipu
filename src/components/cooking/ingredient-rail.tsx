"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecipeDetail } from "@/lib/domain/recipe-api";
import { requestIngredientImageApi } from "@/lib/http/api-client";

type IngredientItem = {
  ingredient: RecipeDetail["ingredients"][number];
  kind: "ingredient" | "seasoning";
  index: number;
};

type ImagePhase = "idle" | "requesting" | "loading" | "ready" | "failed";

function IngredientVisual({ ingredient, recipeId, kind, index, checked, railRef }: IngredientItem & { recipeId: number; checked: boolean; railRef: RefObject<HTMLDivElement | null> }) {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<ImagePhase>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const loading = phase === "requesting" || phase === "loading";

  useEffect(() => {
    let cancelled = false;
    let requested = false;
    let observer: IntersectionObserver | null = null;
    let controller: AbortController | null = null;

    setImageUrl(null);
    setPhase("idle");

    const load = () => {
      if (cancelled || requested) return;
      requested = true;
      setPhase("requesting");
      controller = new AbortController();
      void requestIngredientImageApi(recipeId, kind, index, controller.signal)
        .then(({ imageUrl: nextImageUrl }) => {
          if (cancelled) return;
          setImageUrl(nextImageUrl);
          setPhase("loading");
        })
        .catch(() => {
          if (!cancelled) setPhase("failed");
        });
    };

    const card = avatarRef.current?.closest<HTMLButtonElement>(".cooking-ingredient");
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

  return <div ref={avatarRef} className={`cooking-ingredient-avatar is-${phase} ${loading ? "is-loading" : ""} ${imageUrl ? "has-image" : ""}`} aria-busy={loading}>
    {loading ? <Skeleton aria-hidden="true" className="cooking-ingredient-skeleton" /> : null}
    <span className="cooking-ingredient-fallback" aria-hidden="true">{ingredient.name.slice(0, 1)}</span>
    {loading ? <span className="sr-only">正在生成{ingredient.name}图片</span> : null}
    {imageUrl ? <img data-testid={`ingredient-image-${kind}-${index}`} src={imageUrl} alt="" aria-hidden="true" onLoad={() => setPhase("ready")} onError={() => { setImageUrl(null); setPhase("failed"); }} /> : null}
    {checked ? <span className="cooking-ingredient-ready"><Check aria-hidden="true" /></span> : null}
  </div>;
}

export function IngredientRail({ recipe }: { recipe: RecipeDetail }) {
  const ingredients: IngredientItem[] = [
    ...recipe.ingredients.map((ingredient, index) => ({ ingredient, kind: "ingredient" as const, index })),
    ...recipe.seasonings.map((ingredient, index) => ({ ingredient, kind: "seasoning" as const, index }))
  ];
  const [ready, setReady] = useState<number[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const allReady = ingredients.length > 0 && ingredients.every((_, index) => ready.includes(index));

  function toggleAll() {
    setReady((current) => {
      const currentlyAllReady = ingredients.length > 0 && ingredients.every((_, index) => current.includes(index));
      return currentlyAllReady ? [] : ingredients.map((_, index) => index);
    });
  }

  return <section className="cooking-ingredients" aria-labelledby="cooking-ingredients-title"><div className="cooking-section-heading"><h2 id="cooking-ingredients-title">备料</h2><Button variant="ghost" size="sm" aria-pressed={allReady} data-press-feedback="apple" onClick={toggleAll}>{allReady ? "取消全选" : "全部勾选"}</Button></div><div ref={railRef} className="cooking-ingredient-rail">{ingredients.map(({ ingredient, kind, index }, railIndex) => { const checked = ready.includes(railIndex); return <Button key={`${kind}-${index}`} variant="ghost" className="cooking-ingredient" aria-pressed={checked} data-press-feedback="apple" onClick={() => setReady((current) => checked ? current.filter((item) => item !== railIndex) : [...current, railIndex])}><IngredientVisual ingredient={ingredient} recipeId={recipe.id} kind={kind} index={index} checked={checked} railRef={railRef} /><strong>{ingredient.name}</strong><small>{ingredient.amount}</small></Button>; })}</div></section>;
}
