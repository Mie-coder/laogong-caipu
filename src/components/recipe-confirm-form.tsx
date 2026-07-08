"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
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

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
  unknown: "未知"
};

type ConfirmTab = "overview" | "ingredients" | "steps";

export function RecipeConfirmForm({
  draft,
  imageUrls,
  onChange,
  coverUrl,
  nameError,
  stepsError
}: RecipeConfirmFormProps) {
  const [activeTab, setActiveTab] = useState<ConfirmTab>("overview");
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const ingredientsRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const firstIngredientRef = useRef<HTMLInputElement>(null);
  const firstStepRef = useRef<HTMLTextAreaElement>(null);

  const update = (nextDraft: RecipeDraft) => onChange({ ...nextDraft, steps: renumberSteps(nextDraft.steps) });

  const metadata = [
    draft.mainCategory,
    DIFFICULTY_LABELS[draft.difficulty ?? "unknown"] ?? draft.difficulty,
    draft.cookTimeMinutes ? `${draft.cookTimeMinutes} 分钟` : null
  ].filter(Boolean).join(" · ");
  const totalItemCount = draft.ingredients.length + draft.seasonings.length;
  const coverImage = coverUrl ?? imageUrls?.[0] ?? null;

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

  function scrollToSection(tab: ConfirmTab) {
    setActiveTab(tab);
    const target = tab === "overview" ? summaryRef.current : tab === "ingredients" ? ingredientsRef.current : stepsRef.current;
    target?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  function focusName() {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }

  function handleAddTag() {
    const nextTag = window.prompt("添加标签")?.trim();
    if (!nextTag || draft.tags.includes(nextTag)) return;
    update({ ...draft, tags: [...draft.tags, nextTag] });
  }

  function tabClassName(tab: ConfirmTab) {
    return activeTab === tab ? "is-active" : undefined;
  }

  return (
    <div data-testid="recipe-confirm-form" className="recipe-confirm-form">
      <section ref={summaryRef} data-testid="recipe-confirm-summary" className="recipe-confirm-summary">
        <div data-testid="recipe-confirm-cover" className="recipe-confirm-cover">
          {coverImage ? <img src={coverImage} alt="" className="recipe-confirm-cover-image" /> : null}
        </div>
        <div className="recipe-confirm-summary-copy">
          <label className="recipe-confirm-name-label">
            <span className="sr-only">菜名</span>
            <input
              ref={nameInputRef}
              aria-label="菜名"
              className="recipe-confirm-name"
              value={draft.name}
              onChange={(event) => update({ ...draft, name: event.target.value })}
            />
          </label>
          <button type="button" aria-label="编辑菜名" className="recipe-confirm-edit-button" onClick={focusName}>
            <Pencil aria-hidden="true" />
          </button>
          {nameError ? <p className="recipe-confirm-error">{nameError}</p> : null}
          <p className="recipe-confirm-meta">{metadata}</p>
        </div>
      </section>

      <div className="recipe-confirm-tabs" role="tablist" aria-label="菜谱确认分区">
        <button type="button" role="tab" aria-selected={activeTab === "overview"} className={tabClassName("overview")} onClick={() => scrollToSection("overview")}>概览</button>
        <button type="button" role="tab" aria-selected={activeTab === "ingredients"} className={tabClassName("ingredients")} onClick={() => scrollToSection("ingredients")}>食材</button>
        <button type="button" role="tab" aria-selected={activeTab === "steps"} className={tabClassName("steps")} onClick={() => scrollToSection("steps")}>步骤</button>
      </div>

      <section className="recipe-confirm-section recipe-confirm-tags-section">
        <div className="recipe-confirm-section-header">
          <h2 className="recipe-confirm-section-title">标签</h2>
          <button type="button" aria-label="编辑标签" className="recipe-confirm-section-edit-button" onClick={handleAddTag}>
            <Pencil className="recipe-confirm-section-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="recipe-confirm-tags">
          {draft.tags.map((tag) => (
            <span key={tag} className="recipe-confirm-tag">{tag}</span>
          ))}
          <button type="button" className="recipe-confirm-tag-add" aria-label="添加标签" onClick={handleAddTag}>
            <Plus aria-hidden="true" />
          </button>
        </div>
        <input
          aria-label="标签"
          className="sr-only"
          value={draft.tags.join(" ")}
          onChange={(event) => update({ ...draft, tags: event.target.value.split(/\s+/).filter(Boolean) })}
        />
      </section>

      <section ref={ingredientsRef} data-testid="recipe-confirm-ingredients" className="recipe-confirm-section recipe-confirm-ingredients">
        <div className="recipe-confirm-section-header">
          <h2 className="recipe-confirm-section-title">食材与调料</h2>
          <button type="button" aria-label="编辑食材与调料" className="recipe-confirm-section-edit-button" onClick={() => firstIngredientRef.current?.focus()}>
            <Pencil className="recipe-confirm-section-icon" aria-hidden="true" />
          </button>
        </div>

        <div data-testid="recipe-confirm-ingredient-list" className={`recipe-confirm-ingredient-list${ingredientsExpanded ? " is-expanded" : ""}`}>
          {(["ingredients", "seasonings"] as const).map((key) => (
            <div key={key} className="recipe-confirm-ingredient-group">
              {draft[key].map((item, index) => (
                <div key={`${key}-${index}`} className="recipe-confirm-ingredient-row grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <input
                    ref={key === "ingredients" && index === 0 ? firstIngredientRef : undefined}
                    aria-label={key === "ingredients" ? "食材名称" : "调料名称"}
                    className="recipe-confirm-ingredient-name"
                    value={item.name}
                    onChange={(event) => updateIngredients(key, (items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry))}
                  />
                  <textarea
                    aria-label={key === "ingredients" ? "食材用量" : "调料用量"}
                    rows={1}
                    className="recipe-confirm-ingredient-amount resize-none"
                    value={item.amount}
                    onChange={(event) => updateIngredients(key, (items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))}
                  />
                  <div className="recipe-confirm-ingredient-actions recipe-confirm-layout-hidden col-span-2 flex justify-end">
                    <button
                      type="button"
                      aria-label={`上移${key === "ingredients" ? "食材" : "调料"} ${index + 1}`}
                      onClick={() => moveItem(key, index, -1)}
                    >
                      <ChevronUp aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`下移${key === "ingredients" ? "食材" : "调料"} ${index + 1}`}
                      onClick={() => moveItem(key, index, 1)}
                    >
                      <ChevronDown aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除${key === "ingredients" ? "食材" : "调料"} ${index + 1}`}
                      onClick={() => updateIngredients(key, (items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {key === "ingredients" ? (
                <button type="button" className="recipe-confirm-add-line recipe-confirm-layout-hidden" onClick={() => addItem("ingredients")}>
                  <Plus aria-hidden="true" />
                  添加食材
                </button>
              ) : (
                <button type="button" className="recipe-confirm-add-line recipe-confirm-layout-hidden" onClick={() => addItem("seasonings")}>
                  <Plus aria-hidden="true" />
                  添加调料
                </button>
              )}
            </div>
          ))}
        </div>

        {totalItemCount > 0 ? (
          <button type="button" className="recipe-confirm-more" aria-expanded={ingredientsExpanded} onClick={() => setIngredientsExpanded((expanded) => !expanded)}>
            {ingredientsExpanded ? "收起食材与调料" : `查看全部 ${totalItemCount} 项`}
            {ingredientsExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </button>
        ) : null}
      </section>

      <section ref={stepsRef} className="recipe-confirm-section recipe-confirm-steps">
        <div className="recipe-confirm-section-header">
          <h2 className="recipe-confirm-section-title">制作步骤</h2>
          <button type="button" aria-label="编辑制作步骤" className="recipe-confirm-section-edit-button" onClick={() => firstStepRef.current?.focus()}>
            <Pencil className="recipe-confirm-section-icon" aria-hidden="true" />
          </button>
        </div>
        {stepsError ? <p className="recipe-confirm-error">{stepsError}</p> : null}

        <div data-testid="recipe-confirm-step-list" className={`recipe-confirm-step-list${stepsExpanded ? " is-expanded" : ""}`}>
          {draft.steps.map((step, index) => (
            <div key={`${step.order}-${index}`} data-testid="step-row" className="recipe-confirm-step">
              <span data-testid="step-order" className="recipe-confirm-step-order">
                {String(index + 1).padStart(2, "0")}
              </span>
              <textarea
                ref={index === 0 ? firstStepRef : undefined}
                aria-label="步骤内容"
                className="recipe-confirm-step-text"
                value={step.text}
                onChange={(event) => updateSteps((steps) => steps.map((entry, stepIndex) => stepIndex === index ? { ...entry, text: event.target.value } : entry))}
              />
              <div className="recipe-confirm-step-actions">
                <button
                  type="button"
                  aria-label={`上移步骤 ${index + 1}`}
                  className="recipe-confirm-layout-hidden"
                  onClick={() => updateSteps((steps) => {
                    if (index === 0) return steps;
                    const next = [...steps];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    return next;
                  })}
                >
                  <ChevronUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`下移步骤 ${index + 1}`}
                  className="recipe-confirm-layout-hidden"
                  onClick={() => updateSteps((steps) => {
                    if (index === steps.length - 1) return steps;
                    const next = [...steps];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    return next;
                  })}
                >
                  <ChevronDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`删除步骤 ${index + 1}`}
                  className="recipe-confirm-layout-hidden"
                  onClick={() => updateSteps((steps) => steps.filter((_, stepIndex) => stepIndex !== index))}
                >
                  <Trash2 aria-hidden="true" />
                </button>
                <GripVertical data-testid="recipe-confirm-step-grip" className="recipe-confirm-step-grip" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="recipe-confirm-add-line recipe-confirm-layout-hidden"
          onClick={() => updateSteps((steps) => [...steps, { order: steps.length + 1, text: "" }])}
        >
          <Plus aria-hidden="true" />
          添加步骤
        </button>
        {draft.steps.length > 0 ? (
          <button type="button" className="recipe-confirm-more" aria-expanded={stepsExpanded} onClick={() => setStepsExpanded((expanded) => !expanded)}>
            {stepsExpanded ? "收起制作步骤" : `查看全部 ${draft.steps.length} 步`}
            {stepsExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </button>
        ) : null}
      </section>

      {imageUrls && imageUrls.length > 0 ? <div className="hidden" aria-hidden="true">{imageUrls.length}</div> : null}
    </div>
  );
}
