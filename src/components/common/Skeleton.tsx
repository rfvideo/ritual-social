export function SkeletonPost() {
  return (
    <div className="flex gap-3 border-b border-ash-200 px-4 py-4">
      <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="flex gap-6 pt-1">
          <div className="skeleton h-3 w-10 rounded" />
          <div className="skeleton h-3 w-10 rounded" />
          <div className="skeleton h-3 w-10 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonFeed({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPost key={i} />
      ))}
    </div>
  );
}

export function SkeletonProfileHeader() {
  return (
    <div>
      <div className="skeleton h-40 w-full sm:h-52" />
      <div className="px-4 pb-4">
        <div className="skeleton -mt-10 h-20 w-20 rounded-full ring-4 ring-void" />
        <div className="skeleton mt-4 h-5 w-40 rounded" />
        <div className="skeleton mt-2 h-3 w-24 rounded" />
        <div className="skeleton mt-3 h-3 w-full max-w-sm rounded" />
      </div>
    </div>
  );
}
