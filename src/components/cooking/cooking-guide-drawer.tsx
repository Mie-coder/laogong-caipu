"use client";

import { ArrowRight, Lightbulb, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { RecipeDetail } from "@/lib/domain/recipe-api";

export function CookingGuideDrawer({ open, recipe, onOpenChange }: { open: boolean; recipe: RecipeDetail; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const image = recipe.coverImageUrl ?? recipe.imageUrls[0] ?? null;
  return <Drawer open={open} onOpenChange={onOpenChange}><DrawerContent className="cooking-guide-drawer mx-auto w-full max-w-[var(--app-max-width)] border-0 bg-surface"><DrawerHeader className="cooking-guide-header"><DrawerTitle className="sr-only">开始做菜</DrawerTitle><Button variant="secondary" size="icon" aria-label="关闭做菜指引" data-press-feedback="apple" onClick={() => onOpenChange(false)}><X aria-hidden="true" /></Button></DrawerHeader><div className="cooking-guide-body"><span aria-hidden="true" className="cooking-guide-numeral">01</span>{image ? <img className="cooking-guide-image" src={image} alt={`${recipe.name} 成品图`} /> : <div className="cooking-guide-image cooking-guide-image-fallback" role="img" aria-label={`${recipe.name} 成品图`}>{recipe.name}</div>}<h2>准备好了吗？<br />我们将进入做菜模式。</h2><aside className="cooking-guide-tip"><Lightbulb aria-hidden="true" /><p><strong>提示：</strong><br />可以标记完成步骤，或在需要时手动开启语音播报。</p></aside></div><DrawerFooter className="cooking-guide-footer"><Button className="cooking-guide-start" data-press-feedback="apple" onClick={() => { onOpenChange(false); router.push(`/recipes/${recipe.id}/cook`); }}>进入第 1 步<ArrowRight aria-hidden="true" /></Button></DrawerFooter></DrawerContent></Drawer>;
}
