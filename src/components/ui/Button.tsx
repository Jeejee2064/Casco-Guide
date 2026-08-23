import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] text-sm font-semibold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-aqua text-white hover:bg-aqua-dark shadow-sm hover:shadow-md",
        coral: "bg-coral text-white hover:bg-coral-dark shadow-sm hover:shadow-md",
        magenta: "bg-magenta text-white hover:bg-magenta-dark shadow-sm hover:shadow-md",
        outline: "border border-border bg-transparent hover:bg-black/5 dark:hover:bg-white/5",
        ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/5",
        // WhatsApp's own brand green, not a design-system token — same
        // hex ShareMenu already uses for its WhatsApp share tile, reused
        // here so the two stay in sync instead of drifting apart.
        whatsapp: "bg-[#25D366] text-white hover:bg-[#1fbc5c] shadow-sm hover:shadow-md",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
