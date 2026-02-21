import { cn } from '../lib/cn.ts';

interface SkeletonRowProps {
  width?: string;
  className?: string;
}

export function SkeletonRow({ width = 'w-full', className }: SkeletonRowProps) {
  return (
    <div
      className={cn(
        'h-3 animate-pulse rounded bg-slate-200',
        width,
        className,
      )}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn('animate-pulse rounded-lg border border-slate-200 bg-white p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/3 rounded bg-slate-200" />
          <div className="h-2.5 w-1/2 rounded bg-slate-200" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-full rounded bg-slate-200" />
        <div className="h-2.5 w-4/5 rounded bg-slate-200" />
        <div className="h-2.5 w-2/3 rounded bg-slate-200" />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export default function LoadingSkeleton({ className }: { className?: string }) {
  return <SkeletonCard className={className} />;
}

export function SkeletonTable({ rows = 5, columns = 6, className }: SkeletonTableProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 animate-pulse rounded bg-slate-200"
            style={{ width: `${60 + Math.random() * 60}px` }}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-3 animate-pulse rounded bg-slate-200"
              style={{ width: `${40 + ((rowIdx + colIdx) % 4) * 25}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
