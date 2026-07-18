"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setRecipeFavoriteApi } from "@/lib/http/api-client";

export type FavoriteButtonProps = {
  recipeId: number;
  recipeName: string;
  isFavorite: boolean;
  onChanged: (isFavorite: boolean) => void;
  className?: string;
};

export function FavoriteButton({ recipeId, recipeName, isFavorite, onChanged, className }: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [error, setError] = useState("");

  useEffect(() => setFavorite(isFavorite), [isFavorite]);

  async function toggleFavorite() {
    const previous = favorite;
    const target = !previous;
    setFavorite(target);
    setError("");
    onChanged(target);

    try {
      const result = await setRecipeFavoriteApi(recipeId, target);
      setFavorite(result.isFavorite);
      onChanged(result.isFavorite);
    } catch (cause) {
      setFavorite(previous);
      onChanged(previous);
      setError(cause instanceof Error ? cause.message : "收藏失败，请重试");
    }
  }

  const action = favorite ? "取消收藏" : "收藏";
  return <span className="recipe-favorite-control"><Button variant="ghost" size="icon" className={className} aria-label={`${action}菜谱 ${recipeName}`} aria-pressed={favorite} data-press-feedback="apple" onClick={() => void toggleFavorite()}><Bookmark aria-hidden="true" fill={favorite ? "currentColor" : "none"} /></Button>{error ? <span role="status" className="recipe-favorite-error">{error}</span> : null}</span>;
}
