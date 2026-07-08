"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Star } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";

const RATING_LABELS = ["", "不太行", "一般般", "还可以", "很好吃", "超好吃"];
const IMPROVEMENT_TAGS = ["少盐", "火小一点", "时间短一点", "再辣一点"];

function formatCookingTime(date: Date) {
  return `今天 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cookingTimeLabel, setCookingTimeLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCookingTimeLabel(formatCookingTime(new Date()));
      return;
    }
    setWifeFeedback("");
    setWifeRating(0);
    setHusbandImprovementNotes("");
    setSelectedTags([]);
    setCookingTimeLabel("");
    setSubmitting(false);
    setError("");
  }, [open]);

  const canSubmit =
    wifeRating > 0 || wifeFeedback.trim().length > 0 || husbandImprovementNotes.trim().length > 0 || selectedTags.length > 0;

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      return [...current, tag];
    });
  }

  function formatImprovementNotes() {
    return [...selectedTags, husbandImprovementNotes.trim()].filter(Boolean).join("，");
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      await onSubmit({
        wifeFeedback: wifeFeedback.trim(),
        husbandImprovementNotes: formatImprovementNotes(),
        notes: "",
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
    <BottomSheet open={open} title="这次做得怎么样？" onClose={handleClose} variant="review">
      <div className="cook-review-form">
        <p className="cook-review-lead">记录下来，下次会做得更好</p>

        <section className="cook-review-section cook-review-rating-section">
          <div>
            <h3 className="cook-review-section-title">老婆评分</h3>
            <div className="cook-review-stars">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const selected = value <= wifeRating;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} 星，${RATING_LABELS[value]}`}
                    className={`cook-review-star-button ${selected ? "is-selected" : ""}`}
                    onClick={() => setWifeRating(value)}
                  >
                    <Star
                      className="cook-review-star"
                      aria-hidden="true"
                      fill={selected ? "currentColor" : "none"}
                      strokeWidth={1.8}
                    />
                  </button>
                );
              })}
            </div>
            <p className="cook-review-rating-label">{RATING_LABELS[wifeRating] || "点一点星星"}</p>
          </div>
        </section>

        <section className="cook-review-section cook-review-feedback">
          <div>
            <label htmlFor="wife-feedback" className="cook-review-section-title">
              老婆评价
            </label>
            <p className="cook-review-field-hint">她怎么说？</p>
          </div>
          <textarea
            id="wife-feedback"
            aria-label="老婆评价"
            className="cook-review-textarea"
            placeholder="牛腩很软，汤汁特别下饭"
            value={wifeFeedback}
            onChange={(event) => setWifeFeedback(event.target.value)}
          />
        </section>

        <section className="cook-review-section cook-review-improvement">
          <h3 className="cook-review-section-title">下次改进</h3>
          <div className="cook-review-tags">
            {IMPROVEMENT_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`cook-review-tag ${selected ? "is-selected" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <textarea
            aria-label="下次改进"
            className="cook-review-textarea cook-review-improvement-textarea"
            placeholder="番茄可以再多放一个"
            value={husbandImprovementNotes}
            onChange={(event) => setHusbandImprovementNotes(event.target.value)}
          />
        </section>

        <section className="cook-review-time-row">
          <span className="cook-review-section-title">做菜时间</span>
          <span className="cook-review-time-value">
            {cookingTimeLabel}
            <ChevronRight className="cook-review-time-icon" aria-hidden="true" />
          </span>
        </section>

        {error ? <p className="cook-review-error">{error}</p> : null}

        <div className="cook-review-footer">
          <button
            type="button"
            className="cook-review-submit"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "保存中..." : "保存复盘"}
          </button>
          <p className="cook-review-footnote">保存后做过次数将增加 1</p>
        </div>
      </div>
    </BottomSheet>
  );
}
