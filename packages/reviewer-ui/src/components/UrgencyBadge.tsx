import { cn } from '../lib/cn.ts';

interface UrgencyBadgeProps {
  urgency: string;
}

export default function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const isUrgent = urgency === 'URGENT';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        isUrgent
          ? 'bg-red-50 text-red-700 ring-red-600/20'
          : 'bg-slate-50 text-slate-600 ring-slate-500/20',
      )}
    >
      {isUrgent ? 'Urgent' : 'Standard'}
    </span>
  );
}
