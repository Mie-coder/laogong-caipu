import { ArrowRight, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RecentRecipes, type AsyncState } from "@/components/home/recent-recipes";
import { FamilyMenu } from "@/components/auth/family-menu";
import type { RecipeSummary } from "@/lib/domain/recipe-api";
export type HomeScreenProps = { recent: AsyncState<RecipeSummary[]>; onImport: () => void; onRetry: () => void };
export function HomeScreen({ recent, onImport, onRetry }: HomeScreenProps) {
  return <main className="v3-home" data-testid="home-page"><header className="v3-home-header"><div><h1>老公菜谱</h1><p>今晚吃点好的</p></div><div className="v3-home-header-actions"><Button asChild variant="secondary" size="icon" aria-label="查看历史" className="v3-history"><Link href="/recipes?recent=cooked"><History aria-hidden="true" /></Link></Button><FamilyMenu /></div></header><div className="v3-hero-stage" data-testid="home-hero-stage"><span aria-hidden="true">01</span><div className="v3-hero-plate" data-testid="home-hero-plate"><img src="/stitch-v3/stitch-image-20.jpg" alt="菠萝咕噜肉" /></div></div><section className="v3-home-intent"><h2>今天想做什么</h2><Button variant="outline" onClick={onImport} className="v3-import-action" aria-label="导入新菜谱"><Sparkles aria-hidden="true" />从小红书导入<ArrowRight aria-hidden="true" /></Button></section><RecentRecipes recent={recent} onRetry={onRetry} /></main>;
}
