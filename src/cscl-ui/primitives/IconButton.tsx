import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md transition-all duration-150 active:scale-90 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "bg-transparent text-text-muted hover:bg-surface-hover hover:text-text",
        solid: "border border-border text-text-muted hover:border-accent hover:text-accent",
        danger: "border border-border text-text-muted hover:border-danger/50 hover:text-danger",
      },
      size: {
        sm: "h-4 w-4 [&_svg]:h-3.5 [&_svg]:w-3.5",
        md: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(iconButtonVariants({ variant, size }), className)} {...props} />
  ),
);
IconButton.displayName = "IconButton";
