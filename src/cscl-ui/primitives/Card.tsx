import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** Small, non-floating surface chip that sits flush in normal flow — for a
 * floating panel (modal, dropdown, popover), use `shadow-float` directly
 * instead, `Card`'s `shadow-card` is reserved for this flush case. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-surface-raised shadow-card", className)} {...props} />;
}
