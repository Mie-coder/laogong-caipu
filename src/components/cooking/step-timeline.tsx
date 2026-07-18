"use client";

import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { RecipeDetail } from "@/lib/domain/recipe-api";

export function StepTimeline({ recipe, currentStepOrder, completedStepOrders, speechEnabled, onToggleStep, onCurrentStep, onSpeak }: { recipe: RecipeDetail; currentStepOrder: number; completedStepOrders: number[]; speechEnabled: boolean; onToggleStep: (order: number) => void; onCurrentStep: (order: number) => void; onSpeak: (text: string) => void }) {
  return <section className="cooking-steps" aria-labelledby="cooking-steps-title"><div className="cooking-section-heading"><h2 id="cooking-steps-title">制作步骤</h2><span>{completedStepOrders.length} / {recipe.steps.length}</span></div><ol>{recipe.steps.map((step) => { const completed = completedStepOrders.includes(step.order); const current = step.order === currentStepOrder; return <li key={step.order} className={current ? "is-current" : ""}><Button variant="ghost" className="cooking-step-copy" aria-current={current ? "step" : undefined} data-press-feedback="apple" onClick={() => onCurrentStep(step.order)}><span aria-hidden="true">{String(step.order).padStart(2, "0")}</span><p>{step.text}</p></Button><div className="cooking-step-actions"><Checkbox checked={completed} aria-label={`完成第 ${step.order} 步：${step.text}`} data-press-feedback="apple" onCheckedChange={() => onToggleStep(step.order)} />{speechEnabled ? <Button variant="ghost" size="icon" aria-label={`播报第 ${step.order} 步`} data-press-feedback="apple" onClick={() => onSpeak(step.text)}><Volume2 aria-hidden="true" /></Button> : null}</div></li>; })}</ol></section>;
}
