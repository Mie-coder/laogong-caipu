"use client";

import { RecipeDraft } from "@/lib/domain/recipe";
import { DifficultyStars } from "@/components/difficulty-stars";
import { ImageCarousel } from "@/components/image-carousel";

const INGREDIENT_CATEGORIES: Record<string, { label: string; icon: string }> = {
  "肉类": { label: "肉类", icon: "🥩" },
  "禽蛋": { label: "禽蛋", icon: "🥚" },
  "水产": { label: "水产", icon: "🐟" },
  "蔬菜": { label: "蔬菜", icon: "🥬" },
  "豆制品": { label: "豆制品", icon: "🫘" },
  "主食": { label: "主食", icon: "🍚" },
  "调料": { label: "调料", icon: "🧂" },
  "香料": { label: "香料", icon: "🌿" },
  "其他": { label: "其他", icon: "📦" },
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

export function RecipeConfirmForm({
  draft,
  imageUrls,
  onChange
}: {
  draft: RecipeDraft;
  imageUrls?: string[];
  onChange: (draft: RecipeDraft) => void;
}) {
  const update = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) => onChange({ ...draft, [key]: value });

  const allItems = [...draft.ingredients, ...draft.seasonings];
  const groups = groupByCategory(allItems);

  return (
    <div className="space-y-4">
      {imageUrls && imageUrls.length > 0 ? <ImageCarousel images={imageUrls} /> : null}
      <div className="flex items-center gap-3">
        <DifficultyStars difficulty={draft.difficulty} />
      </div>
      <label className="block">
        <span className="text-sm text-muted">菜名</span>
        <input className="mt-1 w-full rounded-card glass-card border border-white/30 px-4 py-3" value={draft.name} onChange={(event) => update("name", event.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-muted">主分类</span>
        <input className="mt-1 w-full rounded-card glass-card border border-white/30 px-4 py-3" value={draft.mainCategory} onChange={(event) => update("mainCategory", event.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-muted">标签，用空格分隔</span>
        <input className="mt-1 w-full rounded-card glass-card border border-white/30 px-4 py-3" value={draft.tags.join(" ")} onChange={(event) => update("tags", event.target.value.split(/\s+/).filter(Boolean))} />
      </label>
      <section className="rounded-card glass-card p-4">
        <h3 className="font-semibold mb-3">食材与调料</h3>
        <div className="space-y-3">
          {Object.entries(groups).map(([cat, items]) => {
            const info = INGREDIENT_CATEGORIES[cat] || INGREDIENT_CATEGORIES["其他"];
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted mb-1.5">{info.icon} {info.label}</p>
                <ul className="space-y-0.5 text-sm text-ink ml-1">
                  {items.map((item, i) => (
                    <li key={`${item.name}-${i}`} className="flex justify-between">
                      <span>{item.name}</span>
                      <span className="text-muted">{item.amount || "适量"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-card glass-card p-4">
        <h3 className="font-semibold">步骤</h3>
        <ol className="mt-2 space-y-2 text-sm text-muted">
          {draft.steps.map((step) => (
            <li key={step.order}>{step.order}. {step.text}</li>
          ))}
        </ol>
      </section>
      <label className="block">
        <span className="text-sm text-muted">小贴士</span>
        <textarea className="mt-1 min-h-24 w-full rounded-card border border-apricot bg-white px-4 py-3" value={draft.tips} onChange={(event) => update("tips", event.target.value)} />
      </label>
    </div>
  );
}
