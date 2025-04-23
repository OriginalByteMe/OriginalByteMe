"use client"

import { cn } from "@/lib/utils"

type ColorVariant = "emerald" | "blue" | "purple" | "amber" | "gold" | "rose" | "gray" | "spotify" | "custom";
type HoverEffect = "lift" | "glow" | "pulse" | "none";
type GlassOpacity = "light" | "medium" | "heavy";

interface FrostedGlassBoxProps {
    className?: string;
    children: React.ReactNode;
    variant?: ColorVariant;
    customColors?: {
        border?: string;
        background?: string;
        shadow?: string;
    };
    onClick?: () => void;
    hoverEffect?: HoverEffect;
    glassOpacity?: GlassOpacity;
}

const variantStyles: Record<ColorVariant, { border: string, background: string, shadow: string }> = {
    emerald: {
        border: "border-emerald-100 dark:border-emerald-900/50",
        background: "bg-emerald-50/50 dark:bg-emerald-900/30",
        shadow: "shadow-emerald-100/20 dark:shadow-emerald-900/10"
    },
    blue: {
        border: "border-blue-100 dark:border-blue-900/50",
        background: "bg-blue-50/50 dark:bg-blue-900/30",
        shadow: "shadow-blue-100/20 dark:shadow-blue-900/10"
    },
    purple: {
        border: "border-purple-100 dark:border-purple-900/50",
        background: "bg-purple-50/50 dark:bg-purple-900/30",
        shadow: "shadow-purple-100/20 dark:shadow-purple-900/10"
    },
    amber: {
        border: "border-amber-100 dark:border-amber-900/50",
        background: "bg-amber-50/50 dark:bg-amber-900/30",
        shadow: "shadow-amber-100/20 dark:shadow-amber-900/10"
    },
    gold: {
        border: "border-gold-100 dark:border-gold-900/50",
        background: "bg-gold-50/50 dark:bg-gold-900/30",
        shadow: "shadow-gold-100/20 dark:shadow-gold-900/10"
    },
    rose: {
        border: "border-rose-100 dark:border-rose-900/50",
        background: "bg-rose-50/50 dark:bg-rose-900/30",
        shadow: "shadow-rose-100/20 dark:shadow-rose-900/10"
    },
    gray: {
        border: "border-gray-100 dark:border-gray-900/50",
        background: "bg-gray-50/50 dark:bg-gray-900/30",
        shadow: "shadow-gray-100/20 dark:shadow-gray-900/10"
    },
    spotify: {
        border: "border-emerald-100 dark:border-emerald-900/50",
        background: "bg-emerald-50/50 dark:bg-emerald-900/30",
        shadow: "shadow-emerald-100/20 dark:shadow-emerald-900/10"
    },
    custom: {
        border: "",
        background: "",
        shadow: ""
    }
};

const hoverEffects = {
    lift: "hover:-translate-y-1 hover:shadow-xl",
    glow: "hover:shadow-2xl hover:shadow-current/25",
    pulse: "hover:animate-pulse",
    none: ""
};

const glassOpacities = {
    light: "backdrop-blur-sm",
    medium: "backdrop-blur-md",
    heavy: "backdrop-blur-lg"
};

export default function FrostedGlassBox({
    className,
    children,
    variant = "emerald",
    customColors,
    hoverEffect = "none",
    glassOpacity = "medium",
    onClick
}: FrostedGlassBoxProps) {
    const styles = variant === "custom" && customColors
        ? {
            border: customColors.border || "",
            background: customColors.background || "",
            shadow: customColors.shadow || ""
        }
        : variantStyles[variant];

    return (
        <div className={cn(
            "flex flex-wrap justify-center gap-4 w-full max-w-4xl mx-auto p-4 mt-2",
            "transition-all duration-300",
            "animate-in fade-in slide-in-from-top-4",
            "rounded-xl border shadow-lg",
            typeof onClick === "function" ? "cursor-pointer" : "",
            styles.border,
            styles.background,
            styles.shadow,
            glassOpacities[glassOpacity],
            hoverEffects[hoverEffect],
            className
        )} {...(onClick && { onClick })}>
            {children}
        </div>
    )
}