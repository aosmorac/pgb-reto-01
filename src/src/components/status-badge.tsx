import { AlertTriangle, CheckCircle2, ShieldX } from 'lucide-react';

import type { VerificationStatus } from '@/types';

interface StatusBadgeProps {
  status: VerificationStatus;
  label?: string;
  compact?: boolean;
}

const labels: Record<VerificationStatus, string> = {
  verified: 'Verificado',
  conflict: 'Contradicción',
  unverified: 'No verificable',
};

export function StatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const Icon = status === 'verified' ? CheckCircle2 : status === 'conflict' ? AlertTriangle : ShieldX;

  return (
    <span className={`status-badge status-badge--${status}${compact ? ' status-badge--compact' : ''}`}>
      <Icon aria-hidden="true" size={compact ? 14 : 16} strokeWidth={2.25} />
      {label ?? labels[status]}
    </span>
  );
}

