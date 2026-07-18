import Link from "next/link";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecipeSummary } from "@/lib/domain/recipe-api";

export type AsyncState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };
export function RecentRecipes({ recent, onRetry }: { recent: AsyncState<RecipeSummary[]>; onRetry: () => void }) {
  return <section className="v3-recent" aria-labelledby="recent-heading"><div className="v3-section-heading"><h2 id="recent-heading">最近做过</h2><Link href="/recipes">查看全部 <ChevronRight aria-hidden="true" /></Link></div>
    {recent.status === "loading" && <div className="v3-recent-card">{[0, 1].map((key) => <div className="v3-recent-row" key={key}><Skeleton aria-label="最近做过加载中" className="v3-recent-image" /><div><Skeleton className="h-5 w-28" /><Skeleton className="mt-2 h-4 w-40" /></div></div>)}</div>}
    {recent.status === "error" && <div className="v3-state"><p>{recent.message}</p><Button variant="ghost" onClick={onRetry}>重试</Button></div>}
    {recent.status === "ready" && recent.data.length === 0 && <div className="v3-state"><p>还没有做过的菜谱</p></div>}
    {recent.status === "ready" && recent.data.length > 0 && <div className="v3-recent-card">{recent.data.map((recipe, index) => <Link href={`/recipes/${recipe.id}`} className="v3-recent-row" key={recipe.id}><div className="v3-recent-image">{recipe.coverImageUrl ? <img src={recipe.coverImageUrl} alt="" /> : <img src={`/stitch-v3/stitch-image-${index === 0 ? "19" : "05"}.jpg`} alt="" />}</div><div className="min-w-0 flex-1"><h3>{recipe.name}</h3><p>{recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} 分钟 · ` : ""}{recipe.wifeRating ? `评分 ${recipe.wifeRating.toFixed(1)}` : `做过 ${recipe.cookedCount} 次`}</p></div><ChevronRight aria-hidden="true" /></Link>)}</div>}
  </section>;
}
