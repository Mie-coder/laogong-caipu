"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DIFFICULTY_LABELS, DifficultyStars } from "@/components/difficulty-stars";

export type RecipeCardSummary = {
  id: number;
  name: string;
  mainCategory: string;
  coverImageUrl: string | null;
  cookedCount: number;
  cookTimeMinutes?: number | null;
  difficulty: string;
  tags: string[];
  latestWifeFeedback: string;
  wifeRating: number;
};

function metadataText(recipe: RecipeCardSummary) {
  return [`${recipe.mainCategory}`, recipe.difficulty, `做过 ${recipe.cookedCount} 次`, recipe.wifeRating > 0 ? `评分 ${recipe.wifeRating.toFixed(1)}` : "评分 --"].join(" ");
}

function formatCookStatus(count: number) {
  return count > 0 ? `做过 ${count} 次` : "还没做过";
}

function formatListMetadata(recipe: RecipeCardSummary) {
  const difficulty = DIFFICULTY_LABELS[recipe.difficulty] ?? "未知";
  const cookTime = recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} 分钟` : "时间未定";
  return [difficulty, cookTime, formatCookStatus(recipe.cookedCount)].join(" · ");
}

export function RecipeCard({
  recipe,
  disableLink,
  variant = "default",
  showChevron = false
}: {
  recipe: RecipeCardSummary;
  disableLink?: boolean;
  variant?: "default" | "list";
  showChevron?: boolean;
}) {
  if (variant === "list") {
    const listContent = (
      <div className="recipe-list-row-card">
        <div className="recipe-list-row-thumb">
          {recipe.coverImageUrl ? (
            <img
              src={recipe.coverImageUrl}
              alt={recipe.name}
              className="recipe-list-row-image"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          ) : (
            <span>无图</span>
          )}
        </div>
        <div className="recipe-list-row-copy">
          <h3 className="recipe-list-row-title">{recipe.name}</h3>
          <p className="recipe-list-row-meta">{formatListMetadata(recipe)}</p>
          <span className="sr-only">{metadataText(recipe)}</span>
        </div>
        {showChevron ? <ChevronRight className="recipe-list-row-chevron" aria-hidden="true" /> : null}
      </div>
    );

    if (disableLink) {
      return listContent;
    }

    return (
      <Link href={`/recipes/${recipe.id}`} className="block">
        {listContent}
      </Link>
    );
  }

  const content = (
    <div className="flex items-center gap-4 py-7">
      <div className="flex aspect-[4/3] w-28 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--color-line)] text-xs text-subtle">
        {recipe.coverImageUrl ? (
          <img
            src={recipe.coverImageUrl}
            alt={recipe.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <span>无图</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[28px] font-bold leading-[1.3] text-ink">{recipe.name}</h3>
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <span>{recipe.mainCategory}</span>
          <span aria-hidden="true">·</span>
          <DifficultyStars difficulty={recipe.difficulty} />
          <span aria-hidden="true">·</span>
          <span>{`做过 ${recipe.cookedCount} 次`}</span>
          <span aria-hidden="true">·</span>
          <span>{recipe.wifeRating > 0 ? `评分 ${recipe.wifeRating.toFixed(1)}` : "评分 --"}</span>
        </div>
        {recipe.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-[4px] border border-line px-2 py-1 text-[12px] leading-[1.4] text-muted">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <span className="sr-only">{metadataText(recipe)}</span>
      </div>
      {!disableLink ? <ChevronRight className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" /> : null}
    </div>
  );

  if (disableLink) {
    return content;
  }

  return (
    <Link href={`/recipes/${recipe.id}`} className="block">
      {content}
    </Link>
  );
}
