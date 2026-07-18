"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";

const RATING_LABELS = ["", "不太行", "一般般", "还可以", "很好吃", "超好吃"];
const IMPROVEMENT_TAGS = ["少盐", "火小一点", "时间短一点", "再辣一点"];
type CookingLogInput = { wifeFeedback: string; husbandImprovementNotes: string; notes: string; wifeRating: number };

function formatCookingTime(date: Date) { return `今天 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }

export function CookingLogSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (input: CookingLogInput) => Promise<void> }) {
  const [wifeFeedback, setWifeFeedback] = useState("");
  const [wifeRating, setWifeRating] = useState(0);
  const [improvementNotes, setImprovementNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cookingTime, setCookingTime] = useState("");

  useEffect(() => {
    if (open) { setCookingTime(formatCookingTime(new Date())); return; }
    setWifeFeedback(""); setWifeRating(0); setImprovementNotes(""); setSelectedTags([]); setSubmitting(false); setError(""); setCookingTime("");
  }, [open]);

  const canSubmit = wifeRating > 0 || wifeFeedback.trim().length > 0 || improvementNotes.trim().length > 0 || selectedTags.length > 0;
  function toggleTag(tag: string) { setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]); }
  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true); setError("");
    try {
      await onSubmit({ wifeFeedback: wifeFeedback.trim(), husbandImprovementNotes: [...selectedTags, improvementNotes.trim()].filter(Boolean).join("，"), notes: "", wifeRating });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
      setSubmitting(false);
    }
  }

  return <Drawer open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !submitting) onClose(); }}><DrawerContent className="cook-review-drawer mx-auto max-h-[85dvh] w-full max-w-[var(--app-max-width)] border-0 bg-surface"><DrawerHeader className="cook-review-header"><DrawerTitle>做菜复盘</DrawerTitle><Button variant="ghost" size="icon" aria-label="关闭" data-press-feedback="apple" onClick={onClose} disabled={submitting}><X aria-hidden="true" /></Button></DrawerHeader><div className="cook-review-form"><p className="cook-review-lead">记录下来，下次会做得更好</p><section className="cook-review-section cook-review-rating-section"><h3 className="cook-review-section-title">老婆评分</h3><div className="cook-review-stars">{Array.from({ length: 5 }, (_, index) => { const value = index + 1; const selected = value <= wifeRating; return <Button key={value} variant="ghost" size="icon" aria-label={`${value} 星，${RATING_LABELS[value]}`} aria-pressed={selected} data-press-feedback="apple" className={`cook-review-star-button ${selected ? "is-selected" : ""}`} onClick={() => setWifeRating(value)}><Star className="cook-review-star" aria-hidden="true" fill={selected ? "currentColor" : "none"} /></Button>; })}</div><p className="cook-review-rating-label">{RATING_LABELS[wifeRating] || "点一点星星"}</p></section><section className="cook-review-section cook-review-feedback"><label htmlFor="wife-feedback" className="cook-review-section-title">老婆评价</label><Textarea id="wife-feedback" aria-label="老婆评价" className="cook-review-textarea" placeholder="记录一下这次的反馈，比如咸淡、口感、食材搭配..." value={wifeFeedback} onChange={(event) => setWifeFeedback(event.target.value)} /></section><section className="cook-review-section cook-review-improvement"><h3 className="cook-review-section-title">下次改进</h3><div className="cook-review-tags">{IMPROVEMENT_TAGS.map((tag) => <Button key={tag} variant="outline" size="sm" aria-pressed={selectedTags.includes(tag)} data-press-feedback="apple" className={`cook-review-tag ${selectedTags.includes(tag) ? "is-selected" : ""}`} onClick={() => toggleTag(tag)}>{tag}</Button>)}</div><Textarea aria-label="下次改进" className="cook-review-textarea cook-review-improvement-textarea" placeholder="番茄可以再多放一个" value={improvementNotes} onChange={(event) => setImprovementNotes(event.target.value)} /></section><section className="cook-review-time-row"><span className="cook-review-section-title">做菜时间</span><span className="cook-review-time-value">{cookingTime}</span></section>{error ? <p className="cook-review-error" role="status">{error}</p> : null}</div><DrawerFooter className="cook-review-footer"><Button className="cook-review-submit" data-press-feedback="apple" disabled={!canSubmit || submitting} onClick={() => void submit()}>{submitting ? "保存中..." : "保存复盘"}</Button><p className="cook-review-footnote">保存后做过次数将增加 1</p></DrawerFooter></DrawerContent></Drawer>;
}
