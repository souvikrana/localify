import { clsx } from '@/utils/clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton rounded-lg', className)} />;
}

/** Card-shaped placeholder used while the library hydrates. */
export function SkeletonCardGrid({ count = 8, tall }: { count?: number; tall?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className={clsx('w-full aspect-square rounded-xl')} />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          {!tall && null}
        </div>
      ))}
    </div>
  );
}

export function SkeletonListRows({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-2 py-2.5">
          <Skeleton className="size-11 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5 max-w-56" />
            <Skeleton className="mt-2 h-3 w-1/4 max-w-36" />
          </div>
          <Skeleton className="hidden h-3 w-10 sm:block" />
        </div>
      ))}
    </div>
  );
}
