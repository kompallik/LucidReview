import { Check, X, HelpCircle } from 'lucide-react';
import { cn } from '../lib/cn.ts';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Check; classes: string }> = {
  MET: { label: 'Met', icon: Check, classes: 'bg-green-50 text-green-700 ring-green-600/20' },
  NOT_MET: { label: 'Not Met', icon: X, classes: 'bg-red-50 text-red-700 ring-red-600/20' },
  UNKNOWN: { label: 'Unknown', icon: HelpCircle, classes: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN!;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        config.classes,
      )}
    >
      <Icon size={12} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}
