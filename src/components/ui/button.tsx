import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-900/20 hover:from-indigo-400 hover:to-indigo-500 hover:shadow-lg hover:shadow-indigo-600/30",
        destructive:
          "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-900/20 hover:from-red-400 hover:to-red-500 hover:shadow-lg hover:shadow-red-600/25",
        outline:
          "border border-line bg-surface text-ink shadow-sm hover:border-line-strong hover:bg-surface-2",
        secondary:
          "bg-surface-2 text-ink shadow-sm hover:bg-line",
        ghost:
          "text-ink-muted hover:bg-surface-2 hover:text-ink",
        soft:
          "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20",
        success:
          "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-900/20 hover:from-emerald-400 hover:to-emerald-500",
        link:
          "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-base",
        xl: "h-12 rounded-2xl px-8 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
