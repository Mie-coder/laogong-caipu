"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { BottomSheet } from "@/components/bottom-sheet";

const WIFE_STARS = [
  { value: 1, emoji: "😔", label: "不太行" },
  { value: 2, emoji: "😐", label: "一般般" },
  { value: 3, emoji: "🙂", label: "还可以" },
  { value: 4, emoji: "😋", label: "好吃" },
  { value: 5, emoji: "😍", label: "超好吃" },
];

export function CookingLogSheet({
  open,
  onClose,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { wifeFeedback: string; husbandImprovementNotes: string; notes: string; wifeRating: number }) => Promise<void>;
}) {
  const [wifeFeedback, setWifeFeedback] = useState("");
  const [wifeRating, setWifeRating] = useState(0);
  const [husbandImprovementNotes, setHusbandImprovementNotes] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    await onSubmit({ wifeFeedback, husbandImprovementNotes, notes, wifeRating });
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    onClose();
  }

  return (
    <BottomSheet open={open} title="这次做得怎么样" onClose={onClose}>
      <div className="space-y-4">
        {/* 老婆星级评分 */}
        <div>
          <p className="text-sm text-muted mb-2">老婆评价</p>
          <div className="flex justify-between gap-1 mb-3">
            {WIFE_STARS.map((star) => (
              <button
                key={star.value}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1.5 transition flex-1 ${
                  wifeRating === star.value ? "rounded-xl glass-card scale-105" : "opacity-50"
                }`}
                onClick={() => setWifeRating(star.value)}
              >
                <span className="text-xl">{star.emoji}</span>
                <span className="text-[11px] text-ink font-medium whitespace-nowrap">{star.label}</span>
              </button>
            ))}
          </div>
          <textarea
            className="min-h-16 w-full rounded-card glass-card border border-white/30 px-4 py-3 text-sm"
            placeholder="也可以写几句评价..."
            value={wifeFeedback}
            onChange={(event) => setWifeFeedback(event.target.value)}
          />
        </div>
        <div>
          <p className="text-sm text-muted mb-1.5">老公改进事项</p>
          <textarea className="min-h-16 w-full rounded-card glass-card border border-white/30 px-4 py-3 text-sm" placeholder="下次注意..." value={husbandImprovementNotes} onChange={(event) => setHusbandImprovementNotes(event.target.value)} />
        </div>
        <button className="w-full rounded-pill btn-primary px-5 py-4 font-semibold text-white" onClick={submit}>保存复盘</button>
      </div>
    </BottomSheet>
  );
}
