import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* `shadow-card`/`shadow-float` are cscl-ui's own theme tokens (see
 * theme/tokens.css), not Tailwind's built-in shadow scale — tailwind-merge
 * doesn't know they're mutually exclusive alternatives in the same group
 * unless told, so two conflicting `shadow-*` classes passed to `cn()` would
 * both survive instead of the later one winning. Add any further custom
 * class groups your app introduces to this same `extend` block. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: ["shadow-card", "shadow-float"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
