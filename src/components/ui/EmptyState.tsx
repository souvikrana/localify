import type { ComponentType, ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  detail?: string;
  actions?: ReactNode;
}

/** Consistent, friendly empty state used across library views. */
export function EmptyState({ icon: Icon, title, detail, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-surface-2 border border-line">
        <Icon className="size-7 text-fg-faint" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-balance">{title}</h3>
      {detail && <p className="mt-1.5 max-w-sm text-sm text-fg-muted text-balance">{detail}</p>}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}
