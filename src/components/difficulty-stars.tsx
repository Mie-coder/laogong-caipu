const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
  unknown: "未知",
};

const DIFFICULTY_STARS: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  unknown: 0,
};

export function DifficultyStars({ difficulty }: { difficulty: string }) {
  const count = DIFFICULTY_STARS[difficulty] ?? 0;
  const label = DIFFICULTY_LABELS[difficulty] ?? "未知";
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-400 tracking-tight">
        {count > 0 ? "★".repeat(count) + "☆".repeat(3 - count) : "☆☆☆"}
      </span>
      <span className="text-muted ml-1">{label}</span>
    </span>
  );
}

export { DIFFICULTY_LABELS };
