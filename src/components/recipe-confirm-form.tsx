"use client";

import { Clock3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { RecipeDraft } from "@/lib/domain/recipe";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RecipeConfirmFormProps = { draft: RecipeDraft; imageUrls?: string[]; onChange: (draft: RecipeDraft) => void; coverUrl?: string | null; nameError?: string; stepsError?: string };
const difficultyLabels: Record<RecipeDraft["difficulty"], string> = { easy: "简单", medium: "中等", hard: "困难", unknown: "难度" };
function withOrders(draft: RecipeDraft): RecipeDraft { return { ...draft, steps: draft.steps.map((step, index) => ({ ...step, order: index + 1 })) }; }

export function RecipeConfirmForm({ draft, imageUrls = [], onChange, coverUrl, nameError, stepsError }: RecipeConfirmFormProps) {
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [tagText, setTagText] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const update = (next: RecipeDraft) => onChange(withOrders(next));
  const cover = coverUrl ?? imageUrls[0] ?? null;
  const editIngredient = (kind: "ingredients" | "seasonings", index: number, field: "name" | "amount", value: string) => update({ ...draft, [kind]: draft[kind].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) });
  const addItem = (kind: "ingredients" | "seasonings") => update({ ...draft, [kind]: [...draft[kind], { name: "", amount: "", type: kind === "ingredients" ? "ingredient" : "seasoning" }] });
  const resetTagEditor = () => { setTagText(""); setEditingTag(null); };
  const openTagEditor = (tag?: string) => { setEditingTag(tag ?? null); setTagText(tag ?? ""); setTagEditorOpen(true); };
  const saveTag = () => {
    const tag = tagText.trim();
    if (tag) update({ ...draft, tags: [...new Set(editingTag ? draft.tags.map((current) => current === editingTag ? tag : current) : [...draft.tags, tag])] });
    resetTagEditor();
    setTagEditorOpen(false);
  };
  const deleteTag = (tag: string) => update({ ...draft, tags: draft.tags.filter((current) => current !== tag) });
  return <div data-testid="recipe-confirm-form" className="recipe-confirm-form">
    <section data-testid="recipe-confirm-summary" className="recipe-confirm-summary"><div className="recipe-confirm-summary-copy"><Label className="sr-only" htmlFor="recipe-name">菜名</Label><Input id="recipe-name" aria-label="菜名" className="recipe-confirm-name" value={draft.name} onChange={(event) => update({ ...draft, name: event.target.value })} placeholder="输入菜谱名称" />{nameError ? <p role="alert" className="recipe-confirm-error">{nameError}</p> : null}<div className="recipe-confirm-tags">{draft.tags.map((tag) => <Button key={tag} variant="ghost" size="sm" className="recipe-confirm-tag" aria-label={`编辑标签 ${tag}`} onClick={() => openTagEditor(tag)}>{tag}</Button>)}<Dialog open={tagEditorOpen} onOpenChange={(open) => { setTagEditorOpen(open); if (!open) resetTagEditor(); }}><DialogTrigger asChild><Button variant="outline" size="icon" aria-label="添加标签" onClick={() => openTagEditor()}><Plus /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{editingTag ? "编辑标签" : "添加标签"}</DialogTitle></DialogHeader><Label htmlFor="new-tag">标签名称</Label><Input id="new-tag" value={tagText} onChange={(event) => setTagText(event.target.value)} /><DialogFooter>{editingTag ? <Button variant="destructive" onClick={() => { deleteTag(editingTag); resetTagEditor(); setTagEditorOpen(false); }}>{`删除标签 ${editingTag}`}</Button> : null}<Button onClick={saveTag}>{editingTag ? "保存修改" : "添加"}</Button></DialogFooter></DialogContent></Dialog></div><div className="recipe-confirm-inline-metadata"><div><Clock3 aria-hidden="true" /><Label className="sr-only" htmlFor="recipe-time">烹饪时间</Label><Input id="recipe-time" aria-label="烹饪时间" inputMode="numeric" value={draft.cookTimeMinutes?.toString() ?? ""} onChange={(event) => update({ ...draft, cookTimeMinutes: event.target.value ? Number(event.target.value) : null })} /><span>分钟</span></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label="难度">{difficultyLabels[draft.difficulty]}</Button></DropdownMenuTrigger><DropdownMenuContent>{(["easy", "medium", "hard"] as const).map((difficulty) => <DropdownMenuItem key={difficulty} onSelect={() => update({ ...draft, difficulty })}>{difficultyLabels[difficulty]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div></div><div data-testid="recipe-confirm-cover" className="recipe-confirm-cover">{cover ? <img src={cover} alt="菜谱封面" className="recipe-confirm-cover-image" /> : null}</div></section>
    <section data-testid="recipe-confirm-ingredients" className="recipe-confirm-section"><div className="recipe-confirm-section-heading"><h2 className="recipe-confirm-section-title">食材与调料</h2><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="添加食材或调料"><Plus /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => addItem("ingredients")}>添加食材</DropdownMenuItem><DropdownMenuItem onSelect={() => addItem("seasonings")}>添加调料</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{(["ingredients", "seasonings"] as const).map((kind) => <div key={kind} className="recipe-confirm-ingredient-group">{draft[kind].map((item, index) => <div key={`${kind}-${index}`} className="recipe-confirm-ingredient-row"><Input aria-label={kind === "ingredients" ? "食材名称" : "调料名称"} value={item.name} onChange={(event) => editIngredient(kind, index, "name", event.target.value)} /><Textarea aria-label={kind === "ingredients" ? "食材用量" : "调料用量"} rows={1} className="recipe-confirm-ingredient-amount" value={item.amount} onChange={(event) => editIngredient(kind, index, "amount", event.target.value)} /><Button variant="ghost" size="icon" aria-label={`删除${kind === "ingredients" ? "食材" : "调料"} ${index + 1}`} onClick={() => update({ ...draft, [kind]: draft[kind].filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></div>)}</div>)}</section>
    <section className="recipe-confirm-section"><div className="recipe-confirm-section-heading"><h2 className="recipe-confirm-section-title">制作步骤</h2><Button variant="ghost" size="icon" aria-label="添加步骤" onClick={() => update({ ...draft, steps: [...draft.steps, { order: draft.steps.length + 1, text: "" }] })}><Plus /></Button></div>{stepsError ? <p role="alert" className="recipe-confirm-error">{stepsError}</p> : null}<div data-testid="recipe-confirm-step-list" className="recipe-confirm-step-list">{draft.steps.map((step, index) => <div key={`${step.order}-${index}`} data-testid="step-row" className="recipe-confirm-step"><span data-testid="step-order" className="recipe-confirm-step-order">{index + 1}</span><Textarea aria-label="步骤内容" className="recipe-confirm-step-text" value={step.text} onChange={(event) => update({ ...draft, steps: draft.steps.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} /><Button variant="ghost" size="icon" aria-label={`删除步骤 ${index + 1}`} onClick={() => update({ ...draft, steps: draft.steps.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></div>)}</div></section>
  </div>;
}
