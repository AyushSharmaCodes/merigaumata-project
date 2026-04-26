import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/core/utils/utils";

const tagVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                outline: "text-foreground",
                // Custom variants mapped to styles
                category: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
                info: "border-transparent bg-sky-100 text-sky-800 hover:bg-sky-200",
                success: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
                warning: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
                error: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
                new: "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200",
                discount: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200",
            },
            size: {
                default: "px-2.5 py-0.5 text-xs",
                sm: "px-2 py-[2px] text-[10px]",
                lg: "px-3 py-1 text-sm",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface TagProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tagVariants> { }

function Tag({ className, variant, size, ...props }: TagProps) {
    return (
        <div className={cn(tagVariants({ variant, size }), className)} {...props} />
    );
}

export { Tag, tagVariants };
