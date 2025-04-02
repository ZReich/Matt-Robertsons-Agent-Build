import { cva } from "class-variance-authority"
import { TrendingDown, TrendingUp } from "lucide-react"

import type { BadgeProps } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

import { cn, formatPercent, isNonNegative } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"

const percentageChangeBadgeVariants = cva("gap-0", {
  variants: {
    variant: {
      default:
        "data-[non-negative-change=true]:bg-success data-[non-negative-change=false]:bg-destructive",
      ghost:
        "bg-transparant text-sm text-foreground data-[non-negative-change=true]:text-success data-[non-negative-change=false]:text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface PercentageChangeBadgeProps
  extends Omit<BadgeProps, "variant">,
    VariantProps<typeof percentageChangeBadgeVariants> {
  value: number
}

export function PercentageChangeBadge({
  value,
  className,
  variant,
  ...props
}: PercentageChangeBadgeProps) {
  const isNonNegativeChange = isNonNegative(value)

  return (
    <Badge
      className={cn(percentageChangeBadgeVariants({ variant }), className)}
      data-non-negative-change={isNonNegativeChange}
      {...props}
      variant="destructive"
    >
      {isNonNegativeChange && <span>+</span>}
      <span>{formatPercent(value)}</span>
      <span className="ms-1" aria-hidden>
        {isNonNegativeChange ? (
          <TrendingUp className="size-4" />
        ) : (
          <TrendingDown className="size-4" />
        )}
      </span>
    </Badge>
  )
}
