"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { addCookingLogApi, getRecipeApi } from "@/lib/http/api-client";
import { CookingLogSheet } from "@/components/cooking-log-sheet";
import { DifficultyStars } from "@/components/difficulty-stars";
import { ImageCarousel } from "@/components/image-carousel";
import { SkeletonCard } from "@/components/skeleton-card";
import { Toast } from "@/components/toast";

const INGREDIENT_CATEGORIES: Record<string, string> = {
  "肉类": "🥩", "禽蛋": "🥚", "水产": "🐟", "蔬菜": "🥬",
  "豆制品": "🫘", "主食": "🍚", "调料": "🧂", "香料": "🌿", "其他": "📦",
};

const MEAT_KEYWORDS = ["肉", "牛", "猪", "羊", "鸡", "鸭", "排骨", "五花", "里脊", "腿", "腩", "肠", "培根", "火腿", "腊"];
const EGG_KEYWORDS = ["蛋", "鸡蛋", "鸭蛋", "鹌鹑蛋"];
const SEAFOOD_KEYWORDS = ["鱼", "虾", "蟹", "贝", "蚝", "蛤", "鱿", "章鱼", "海参", "鲍", "三文鱼", "鳕", "带鱼"];
const VEG_KEYWORDS = ["菜", "瓜", "椒", "茄", "豆", "菇", "菌", "葱", "姜", "蒜", "洋", "薯", "萝卜", "芹", "菠", "笋", "藕", "花菜", "西兰花", "生菜", "白菜", "玉米", "山药", "芋", "莲", "秋葵", "芦笋"];
const TOFU_KEYWORDS = ["豆腐", "豆皮", "腐竹", "豆干", "豆泡", "千张", "百叶"];
const STAPLE_KEYWORDS = ["面", "粉", "米", "饭", "馒头", "饼", "包", "饺子", "馄饨", "年糕", "粉条", "粉丝", "面条"];

function categorizeIngredient(name: string): string {
  if (MEAT_KEYWORDS.some((k) => name.includes(k))) return "肉类";
  if (EGG_KEYWORDS.some((k) => name.includes(k))) return "禽蛋";
  if (SEAFOOD_KEYWORDS.some((k) => name.includes(k))) return "水产";
  if (TOFU_KEYWORDS.some((k) => name.includes(k))) return "豆制品";
  if (STAPLE_KEYWORDS.some((k) => name.includes(k))) return "主食";
  if (VEG_KEYWORDS.some((k) => name.includes(k))) return "蔬菜";
  return "其他";
}

function groupByCategory(items: Array<{ name: string; amount: string; type: string }>) {
  const groups: Record<string, Array<{ name: string; amount: string; type: string }>> = {};
  for (const item of items) {
    const cat = item.type === "seasoning" ? "调料" : categorizeIngredient(item.name);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

export function RecipeDetail({ id }: { id: number }) {
  const [recipe, setRecipe] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [showCookButton, setShowCookButton] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    const result = await getRecipeApi(id);
    setRecipe(result.recipe);
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowCookButton(nearBottom);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [recipe]);

  if (!recipe) return <SkeletonCard />;

  const allItems = [...recipe.ingredients, ...recipe.seasonings];
  const groups = groupByCategory(allItems);
  const latestLog = recipe.cookingLogs?.[0] || null;

  return (
    <>
      <div ref={scrollRef} className="space-y-5 pb-28" style={{ maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
        <div>
          <p className="text-sm text-muted">{recipe.mainCategory}</p>
          <h1 className="text-2xl font-semibold text-ink">{recipe.name}</h1>
          <div className="mt-1 flex items-center gap-3">
            <DifficultyStars difficulty={recipe.difficulty} />
            <span className="text-sm text-muted">做过 {recipe.cookedCount} 次</span>
            {recipe.cookedCount > 0 ? <span className="text-lg">👨‍🍳</span> : null}
          </div>
        </div>

        {(recipe.imageUrls && recipe.imageUrls.length > 0) ? <ImageCarousel images={recipe.imageUrls} /> :
         (recipe.coverImageUrl ? <ImageCarousel images={[recipe.coverImageUrl]} /> : null)}

        <section className="rounded-card glass-card p-4">
          <h2 className="font-semibold mb-3">食材与调料</h2>
          <div className="space-y-3">
            {Object.entries(groups).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted mb-1.5">{INGREDIENT_CATEGORIES[cat] || "📦"} {cat}</p>
                <ul className="space-y-0.5 text-sm text-ink ml-1">
                  {items.map((item, i) => (
                    <li key={`${item.name}-${i}`} className="flex justify-between">
                      <span>{item.name}</span>
                      <span className="text-muted">{item.amount || "适量"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card glass-card p-4">
          <h2 className="font-semibold">步骤</h2>
          <ol className="mt-3 space-y-3 text-sm text-muted">
            {recipe.steps.map((step: any) => (
              <li key={step.order}><span className="font-semibold text-coral">{step.order}.</span> {step.text}</li>
            ))}
          </ol>
        </section>

        {recipe.tips ? (
          <section className="rounded-card glass-card p-4 text-sm text-ink">
            <h2 className="font-semibold">小贴士</h2>
            <p className="mt-2">{recipe.tips}</p>
          </section>
        ) : null}

        {latestLog ? (
          <section className="rounded-card glass-card p-4">
            <h2 className="font-semibold">最近做过</h2>
            <div className="mt-3 rounded-card glass-card p-3 text-sm">
              {latestLog.wifeRating > 0 ? (
                <p className="text-sm">老婆星级：<span className="text-lg">{"⭐".repeat(latestLog.wifeRating)}</span></p>
              ) : null}
              {latestLog.wifeFeedback ? (
                <p className="mt-1 text-coral font-medium">老婆评价：{latestLog.wifeFeedback}</p>
              ) : null}
              {latestLog.husbandImprovementNotes ? (
                <p className="mt-1 text-muted">老公改进：{latestLog.husbandImprovementNotes}</p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-card glass-card p-4">
            <h2 className="font-semibold">做过复盘</h2>
            <p className="mt-3 text-sm text-muted">还没记录做过。</p>
          </section>
        )}
      </div>

      <motion.button
        className="fixed bottom-24 left-4 right-4 z-20 mx-auto max-w-[387px] rounded-pill btn-primary py-4 text-center font-semibold text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showCookButton ? 1 : 0, y: showCookButton ? 0 : 20 }}
        transition={{ duration: 0.25 }}
        onClick={() => setSheetOpen(true)}
        disabled={!showCookButton}
        style={{ pointerEvents: showCookButton ? "auto" : "none" }}
      >
        标记做过
      </motion.button>

      <CookingLogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={async (input) => {
          await addCookingLogApi(id, input);
          setToast("📝 已保存");
          await load();
        }}
      />
      <Toast message={toast} />
    </>
  );
}
