"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";

const RATING_LABELS = ["", "不太行", "一般般", "还可以", "很好吃", "超好吃"];

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) return;
    setWifeFeedback("");
    setWifeRating(0);
    setHusbandImprovementNotes("");
    setNotes("");
    setSubmitting(false);
    setError("");
  }, [open]);

  const canSubmit =
    wifeRating > 0 || wifeFeedback.trim().length > 0 || husbandImprovementNotes.trim().length > 0 || notes.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      await onSubmit({
        wifeFeedback: wifeFeedback.trim(),
        husbandImprovementNotes: husbandImprovementNotes.trim(),
        notes: notes.trim(),
        wifeRating
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  return (
    <BottomSheet open={open} title="这次做得怎么样？" onClose={handleClose}>
      <div className="space-y-6 pb-2">
        <p className="text-sm text-muted">记录下来，下次会做得更好</p>

        <section className="space-y-4 border-b border-line pb-6">
          <div className="space-y-2">
            <h3 className="text-[17px] font-semibold text-ink">老婆评分</h3>
            <div className="flex items-center justify-between gap-2">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const selected = value <= wifeRating;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} 星，${RATING_LABELS[value]}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-accent"
                    onClick={() => setWifeRating(value)}
                  >
                    <Star
                      className="h-9 w-9"
                      aria-hidden="true"
                      fill={selected ? "currentColor" : "none"}
                      strokeWidth={1.8}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[17px] text-ink">{RATING_LABELS[wifeRating] || "点一点星星"}</p>
          </div>
        </section>

        <section className="space-y-3 border-b border-line pb-6">
          <div className="space-y-2">
            <label htmlFor="wife-feedback" className="text-[17px] font-semibold text-ink">
              老婆评价
            </label>
            <p className="text-sm text-muted">她怎么说？</p>
          </div>
          <textarea
            id="wife-feedback"
            aria-label="老婆评价"
            className="min-h-[88px] w-full resize-none border-0 border-b border-line bg-transparent px-0 py-0 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-ink"
            placeholder="牛腩很软，汤汁特别下饭"
            value={wifeFeedback}
            onChange={(event) => setWifeFeedback(event.target.value)}
          />
        </section>

        <section className="space-y-4 border-b border-line pb-6">
          <h3 className="text-[17px] font-semibold text-ink">下次改进</h3>
          <textarea
            aria-label="下次改进"
            className="min-h-[88px] w-full resize-none border-0 border-b border-line bg-transparent px-0 py-0 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-ink"
            placeholder="番茄可以再多放一个"
            value={husbandImprovementNotes}
            onChange={(event) => setHusbandImprovementNotes(event.target.value)}
          />
        </section>

        <section className="space-y-3 border-b border-line pb-6">
          <div className="space-y-2">
            <label htmlFor="cooking-notes" className="text-[17px] font-semibold text-ink">
              备注
            </label>
            <p className="text-sm text-muted">记下这次做菜的小发现</p>
          </div>
          <textarea
            id="cooking-notes"
            aria-label="备注"
            className="min-h-[88px] w-full resize-none border-0 border-b border-line bg-transparent px-0 py-0 text-[16px] text-ink outline-none placeholder:text-subtle focus:border-ink"
            placeholder="比如火候、锅具或者下次想试的变化"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </section>

        <section className="flex items-center justify-between border-b border-line pb-6">
          <h3 className="text-[17px] font-semibold text-ink">做菜时间</h3>
          <p className="text-[17px] text-muted">今天 19:30</p>
        </section>

        {error ? <p className="text-sm text-accent">{error}</p> : null}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            className="min-h-12 w-full rounded-[8px] bg-ink px-5 py-3 text-[17px] font-semibold text-white disabled:bg-disabled"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "保存中..." : "保存复盘"}
          </button>
          <p className="text-center text-sm text-muted">保存后做过次数将增加 1</p>
        </div>
      </div>
    </BottomSheet>
  );
}
