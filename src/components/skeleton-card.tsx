export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl glass-card p-5 shadow-soft">
      <div className="flex gap-4">
        <div className="h-24 w-24 rounded-2xl bg-apricot/70" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-2/3 rounded bg-apricot/70" />
          <div className="h-3 w-1/3 rounded bg-apricot/60" />
          <div className="h-3 w-full rounded bg-apricot/50" />
        </div>
      </div>
    </div>
  );
}
