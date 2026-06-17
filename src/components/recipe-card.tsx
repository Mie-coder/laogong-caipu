"use client";

import Link from "next/link";
import { DifficultyStars } from "@/components/difficulty-stars";

export type RecipeCardSummary = {
  id: number;
  name: string;
  mainCategory: string;
  coverImageUrl: string | null;
  cookedCount: number;
  difficulty: string;
  tags: string[];
  latestWifeFeedback: string;
  wifeRating?: number;
};

export function RecipeCard({ recipe, disableLink }: { recipe: RecipeCardSummary; index?: number; disableLink?: boolean }) {
  const content = (
    <div className="flex gap-4 p-5">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-apricot/60">
        {recipe.coverImageUrl ? (
          <img
            src={recipe.coverImageUrl}
            alt={recipe.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">🍳</div>
        )}
        <span className="absolute right-0 bottom-0 rounded-tl-xl bg-apricot/90 px-2 py-0.5 text-[11px] font-medium text-ink backdrop-blur-sm">
          {recipe.mainCategory}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-ink">
            {recipe.name}
            {recipe.cookedCount > 0 ? <span className="ml-1.5 text-lg leading-none">👨‍🍳</span> : null}
            {recipe.wifeRating ? <span className="ml-1 text-sm leading-none">{"⭐".repeat(recipe.wifeRating)}</span> : null}
          </h3>
          <div className="mt-1.5 flex flex-col gap-1">
            <DifficultyStars difficulty={recipe.difficulty} />
            {recipe.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {recipe.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-pill bg-cream px-2 py-0.5 text-xs text-muted">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted">做过 {recipe.cookedCount} 次</p>
      </div>
    </div>
  );

  if (disableLink) return content;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block rounded-2xl glass-card"
    >
      {content}
    </Link>
  );
}
