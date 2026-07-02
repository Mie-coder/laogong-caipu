export function SkeletonCard({ featured = false }: { featured?: boolean }) {
  if (featured) {
    return (
      <div className="animate-pulse py-3">
        <div className="aspect-[16/9] w-full rounded-[6px] bg-line" />
        <div className="mt-5 h-8 w-40 rounded bg-line" />
        <div className="mt-3 h-4 w-52 rounded bg-line" />
      </div>
    );
  }

  return (
    <div className="animate-pulse border-t border-line py-7 first:border-t-0">
      <div className="flex items-center gap-4">
        <div className="aspect-[4/3] w-28 rounded-[6px] bg-line" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-7 w-32 rounded bg-line" />
          <div className="h-4 w-48 rounded bg-line" />
        </div>
      </div>
    </div>
  );
}
