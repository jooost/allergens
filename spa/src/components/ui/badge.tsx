import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary ring-primary/20",
        success: "bg-green-50 text-green-700 ring-green-600/20",
        warning: "bg-amber-100 text-amber-800 ring-amber-500/40",
        danger: "bg-red-50 text-red-700 ring-red-600/20",
        muted: "bg-gray-50 text-gray-600 ring-gray-500/20",
        contains: "bg-red-50 text-red-700 ring-red-600/20",
        maycontain: "bg-amber-50 text-amber-700 ring-amber-600/20",
        free: "bg-green-50 text-green-700 ring-green-600/20",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
