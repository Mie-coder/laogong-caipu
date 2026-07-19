"use client";

import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeDetail } from "@/lib/domain/recipe-api";

export function StepTimeline({ recipe, currentStepOrder, completedStepOrders, speechEnabled, onToggleStep, onSpeak }: { recipe: RecipeDetail; currentStepOrder: number; completedStepOrders: number[]; speechEnabled: boolean; onToggleStep: (order: number) => void; onSpeak: (text: string) => void }) {
  return <section className="cooking-steps" aria-labelledby="cooking-steps-title"><div className="cooking-section-heading"><h2 id="cooking-steps-title">制作步骤</h2><span>{completedStepOrders.length} / {recipe.steps.length}</span></div><ol>{recipe.steps.map((step) => { const completed = completedStepOrders.includes(step.order); const current = step.order === currentStepOrder; return <li key={step.order} className={`${current ? "is-current" : ""} ${completed ? "is-completed" : ""}`.trim()}><Button variant="ghost" className="cooking-step-copy" aria-current={current ? "step" : undefined} aria-pressed={completed} aria-label={`${completed ? "撤销完成" : "完成"}第 ${step.order} 步：${step.text}`} data-press-feedback="apple" onClick={() => onToggleStep(step.order)}><span aria-hidden="true">{String(step.order).padStart(2, "0")}</span><p>{step.text}</p></Button>{speechEnabled ? <Button variant="ghost" size="icon" aria-label={`播报第 ${step.order} 步`} data-press-feedback="apple" onClick={() => onSpeak(step.text)}><Volume2 aria-hidden="true" /></Button> : null}</li>; })}</ol></section>;
}
