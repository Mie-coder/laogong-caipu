import { Gauge } from "lucide-react";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
  unknown: "未知",
};

export function DifficultyStars({ difficulty }: { difficulty: string }) {
  const label = DIFFICULTY_LABELS[difficulty] ?? "未知";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted" aria-label={`难度：${label}`}>
      <Gauge className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export { DIFFICULTY_LABELS };
