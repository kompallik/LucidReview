import { cn } from '../lib/cn.ts';

const DETERMINATION_CONFIG: Record<string, { label: string; classes: string }> = {
  AUTO_APPROVE: { label: 'Auto-Approved', classes: 'bg-green-50 text-green-700 ring-green-600/20' },
  MD_REVIEW: { label: 'MD Review', classes: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
  DENY: { label: 'Denied', classes: 'bg-red-50 text-red-700 ring-red-600/20' },
  MORE_INFO: { label: 'More Info Needed', classes: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  pending: { label: 'Pending', classes: 'bg-slate-50 text-slate-600 ring-slate-500/20' },
};

interface DeterminationBadgeProps {
  determination?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function DeterminationBadge({ determination, size = 'sm' }: DeterminationBadgeProps) {
  const config = DETERMINATION_CONFIG[determination ?? 'pending'] ?? DETERMINATION_CONFIG.pending!;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset',
        config.classes,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-3 py-1.5 text-sm',
      )}
    >
      {config.label}
    </span>
  );
}
