import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmering placeholder used while Dexie live-queries resolve.
 * Pure CSS — no layout shift, respects prefers-reduced-motion via globals.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "shimmer-surface rounded-xl bg-surface-2",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
