"use client";

import { Pencil, Plus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { RecipeDraft } from "@/lib/domain/recipe";

type RecipeConfirmFormProps = {
  draft: RecipeDraft;
  imageUrls?: string[];
  onChange: (draft: RecipeDraft) => void;
  coverUrl?: string | null;
  nameError?: string;
  stepsError?: string;
};

function renumberSteps(steps: RecipeDraft["steps"]) {
  return steps.map((step, index) => ({
    ...step,
    order: index + 1
  }));
}

export function RecipeConfirmForm({
  draft,
  imageUrls,
  onChange,
  coverUrl,
  nameError,
  stepsError
}: RecipeConfirmFormProps) {
  const update = (nextDraft: RecipeDraft) => onChange({ ...nextDraft, steps: renumberSteps(nextDraft.steps) });

  const metadata = [draft.mainCategory, draft.difficulty, draft.cookTimeMinutes ? `${draft.cookTimeMinutes} 分钟` : null].filter(Boolean).join(" · ");

  function updateIngredients(
    key: "ingredients" | "seasonings",
    updater: (items: RecipeDraft["ingredients"]) => RecipeDraft["ingredients"]
  ) {
    update({
      ...draft,
      [key]: updater(draft[key])
    });
  }

  function updateSteps(updater: (steps: RecipeDraft["steps"]) => RecipeDraft["steps"]) {
    update({
      ...draft,
      steps: updater(draft.steps)
    });
  }

  function addItem(key: "ingredients" | "seasonings") {
    updateIngredients(key, (items) => [
      ...items,
      { name: "", amount: "", type: key === "ingredients" ? "ingredient" : "seasoning" }
    ]);
  }

  function moveItem(key: "ingredients" | "seasonings", index: number, direction: -1 | 1) {
    updateIngredients(key, (items) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-line pb-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-[6px] bg-white">
            {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="mb-2 block text-sm text-ink">菜名</span>
              <input
                aria-label="菜名"
                className="w-full border-b border-line bg-transparent pb-2 text-[28px] font-bold leading-[1.3] text-ink outline-none"
                value={draft.name}
                onChange={(event) => update({ ...draft, name: event.target.value })}
              />
            </label>
            {nameError ? <p className="mt-2 text-sm text-[#d45b5b]">{nameError}</p> : null}
            <p className="mt-3 text-[13px] leading-[1.45] text-muted">{metadata}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-6 text-base text-ink">
          <button type="button" className="border-b border-ink pb-1 font-semibold">概览</button>
          <button type="button" className="pb-1 text-muted">食材</button>
          <button type="button" className="pb-1 text-muted">步骤</button>
        </div>
      </section>

      <section className="space-y-4 border-b border-line pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold leading-[1.4] text-ink">标签</h2>
          <Pencil className="h-4 w-4 text-ink" aria-hidden="true" />
        </div>
        <label className="block">
          <span className="sr-only">标签</span>
          <input
            aria-label="标签"
            className="w-full border-b border-line bg-transparent pb-2 text-base text-text outline-none"
            value={draft.tags.join(" ")}
            onChange={(event) => update({ ...draft, tags: event.target.value.split(/\s+/).filter(Boolean) })}
          />
        </label>
      </section>

      <section className="space-y-4 border-b border-line pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold leading-[1.4] text-ink">食材</h2>
          <button type="button" className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-ink" onClick={() => addItem("ingredients")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            添加
          </button>
        </div>

        {(["ingredients", "seasonings"] as const).map((key) => (
          <div key={key} className="space-y-3">
            <p className="text-sm font-semibold text-muted">{key === "ingredients" ? "主食材" : "调料"}</p>
            {draft[key].map((item, index) => (
              <div key={`${key}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
                <input
                  aria-label={key === "ingredients" ? "食材名称" : "调料名称"}
                  className="min-w-0 border-b border-line bg-transparent pb-2 text-base text-text outline-none"
                  value={item.name}
                  onChange={(event) => updateIngredients(key, (items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry))}
                />
                <textarea
                  aria-label={key === "ingredients" ? "食材用量" : "调料用量"}
                  rows={2}
                  className="min-w-0 resize-none border-b border-line bg-transparent pb-2 text-right text-base text-muted outline-none"
                  value={item.amount}
                  onChange={(event) => updateIngredients(key, (items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))}
                />
                <div className="col-span-2 flex items-center justify-end">
                  <button
                    type="button"
                    aria-label={`上移${key === "ingredients" ? "食材" : "调料"} ${index + 1}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                    onClick={() => moveItem(key, index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`下移${key === "ingredients" ? "食材" : "调料"} ${index + 1}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                    onClick={() => moveItem(key, index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除${key === "ingredients" ? "食材" : "调料"} ${index + 1}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                    onClick={() => updateIngredients(key, (items) => items.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}

            {key === "seasonings" ? (
              <button type="button" className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-ink" onClick={() => addItem("seasonings")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                添加调料
              </button>
            ) : null}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold leading-[1.4] text-ink">步骤</h2>
          <button
            type="button"
            className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-ink"
            onClick={() => updateSteps((steps) => [...steps, { order: steps.length + 1, text: "" }])}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            添加
          </button>
        </div>
        {stepsError ? <p className="text-sm text-[#d45b5b]">{stepsError}</p> : null}

        <div className="space-y-5">
          {draft.steps.map((step, index) => (
            <div key={`${step.order}-${index}`} data-testid="step-row" className="border-b border-line pb-5">
              <div className="mb-3 flex items-center justify-between">
                <span data-testid="step-order" className="text-[28px] font-bold leading-[1.3] text-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`上移步骤 ${index + 1}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                    onClick={() => updateSteps((steps) => {
                      if (index === 0) return steps;
                      const next = [...steps];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`下移步骤 ${index + 1}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                    onClick={() => updateSteps((steps) => {
                      if (index === steps.length - 1) return steps;
                      const next = [...steps];
                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                      return next;
                    })}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除步骤 ${index + 1}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                    onClick={() => updateSteps((steps) => steps.filter((_, stepIndex) => stepIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Pencil className="mt-2 h-4 w-4 text-ink" aria-hidden="true" />
                <textarea
                  aria-label="步骤内容"
                  className="min-h-20 flex-1 border-b border-line bg-transparent pb-2 text-base leading-[1.65] text-text outline-none"
                  value={step.text}
                  onChange={(event) => updateSteps((steps) => steps.map((entry, stepIndex) => stepIndex === index ? { ...entry, text: event.target.value } : entry))}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {imageUrls && imageUrls.length > 0 ? <div className="hidden" aria-hidden="true">{imageUrls.length}</div> : null}
    </div>
  );
}
