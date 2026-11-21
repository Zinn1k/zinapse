import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Shared empty / zero-state block. Dashed frame, soft icon halo,
 * optional call-to-action row.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-16 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-2xl bg-brand/20 blur-xl" />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-brand shadow-sm">
            {icon}
          </div>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-ink">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center justify-center gap-3 pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
