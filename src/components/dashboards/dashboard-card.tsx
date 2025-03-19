import * as React from "react"
import { cva } from "class-variance-authority"
import { EllipsisVertical } from "lucide-react"

import type { FormatStyleType, IconType } from "@/types"
import type { VariantProps } from "class-variance-authority"

import { cn, formatOverviewCardValue } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PercentageChangeBadge } from "./percentage-change-badge"

const cardContentVariants = cva("flex flex-col justify-between gap-y-6", {
  variants: {
    size: {
      xs: "h-32",
      sm: "h-64",
      default: "h-96",
      lg: "h-[29rem]",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  period?: string
  action?: React.ReactNode
  contentClassName?: string
  size?: VariantProps<typeof cardContentVariants>["size"]
}

const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  (
    { title, period, action, children, contentClassName, size, ...props },
    ref
  ) => (
    <Card ref={ref} asChild {...props}>
      <article>
        <div className="flex justify-between p-6">
          <div>
            <CardTitle>{title}</CardTitle>
            {period && <CardDescription>{period}</CardDescription>}
          </div>
          {action}
        </div>
        <CardContent
          className={cn(cardContentVariants({ size }), contentClassName)}
        >
          {children}
        </CardContent>
      </article>
    </Card>
  )
)
DashboardCard.displayName = "DashboardCard"

interface DashboardOverviewCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  data: {
    value: number
    percentageChange: number
  }
  title: string
  period?: string
  action?: React.ReactNode
  icon: IconType
  formatStyle?: FormatStyleType
  contentClassName?: string
}

const DashboardOverviewCard = React.forwardRef<
  HTMLDivElement,
  DashboardOverviewCardProps
>(
  (
    {
      data,
      title,
      period,
      action,
      icon: Icon,
      formatStyle = "regular",
      className,
      contentClassName,
      ...props
    },
    ref
  ) => {
    const value = formatOverviewCardValue(data.value, formatStyle)

    return (
      <Card
        ref={ref}
        className={cn("flex flex-col justify-between", className)}
        asChild
        {...props}
      >
        <article>
          <div className="flex justify-between p-6">
            <div>
              <CardTitle className="inline-flex gap-x-1">
                <Icon className="size-4" aria-hidden />
                <span>{title}</span>
              </CardTitle>
              {period && <CardDescription>{period}</CardDescription>}
            </div>
            {action}
          </div>
          <CardContent className={cn("space-y-1", contentClassName)}>
            <p className="text-2xl font-semibold break-all">{value}</p>
            <PercentageChangeBadge value={data.percentageChange} />
          </CardContent>
        </article>
      </Card>
    )
  }
)
DashboardOverviewCard.displayName = "DashboardOverviewCard"

interface DashboardOverviewCardV2Props
  extends React.HTMLAttributes<HTMLDivElement> {
  data: {
    value: number
    percentageChange: number
  }
  title: string
  period: string
  action?: React.ReactNode
  icon: IconType
  iconColor?: string
  formatStyle?: FormatStyleType
  contentClassName?: string
}

const DashboardOverviewCardV2 = React.forwardRef<
  HTMLDivElement,
  DashboardOverviewCardV2Props
>(
  (
    {
      data,
      title,
      period,
      action,
      icon: Icon,
      iconColor = "hsl(var(--primary))",
      formatStyle = "regular",
      className,
      contentClassName,
      ...props
    },
    ref
  ) => {
    const value = formatOverviewCardValue(data.value, formatStyle)

    return (
      <Card
        ref={ref}
        className={cn("flex flex-col justify-between", className)}
        asChild
        {...props}
      >
        <article>
          <div className="flex justify-between p-6">
            <div className="flex items-center gap-x-2">
              <Badge
                style={{
                  backgroundColor: iconColor,
                }}
                className="size-12 aspect-square shadow-none"
                aria-hidden
              >
                <Icon className="size-full" />
              </Badge>
              <div>
                <CardDescription>{period}</CardDescription>
                <PercentageChangeBadge
                  variant="ghost"
                  value={data.percentageChange}
                  className="p-0"
                />
              </div>
            </div>
            {action}
          </div>
          <CardContent className={cn("space-y-1", contentClassName)}>
            <CardTitle className="text-muted-foreground font-normal">
              {title}
            </CardTitle>
            <p className="text-2xl font-semibold break-all">{value}</p>
          </CardContent>
        </article>
      </Card>
    )
  }
)
DashboardOverviewCardV2.displayName = "DashboardOverviewCardV2"

interface DashboardOverviewCardV3Props
  extends React.HTMLAttributes<HTMLDivElement> {
  data: {
    value: number
    percentageChange: number
  }
  title: string
  action?: React.ReactNode
  chart: React.ReactNode
  formatStyle?: FormatStyleType
  contentClassName?: string
}

const DashboardOverviewCardV3 = React.forwardRef<
  HTMLDivElement,
  DashboardOverviewCardV3Props
>(
  (
    {
      data,
      title,
      action,
      chart,
      formatStyle = "regular",
      contentClassName,
      className,
      ...props
    },
    ref
  ) => {
    const value = formatOverviewCardValue(data.value, formatStyle)

    return (
      <Card
        ref={ref}
        className={cn("flex flex-col justify-between", className)}
        asChild
        {...props}
      >
        <article>
          <div className="flex justify-between p-6 pb-3">
            <div>
              <CardTitle className="text-muted-foreground font-normal">
                {title}
              </CardTitle>
              <div className="inline-flex flex-wrap items-baseline gap-x-1">
                <p className="text-2xl font-semibold break-all">{value}</p>
                <PercentageChangeBadge
                  variant="ghost"
                  value={data.percentageChange}
                  className="p-0"
                />
              </div>
            </div>
            {action}
          </div>
          <CardContent
            className={cn(
              "flex justify-center items-center p-0",
              contentClassName
            )}
          >
            {chart}
          </CardContent>
        </article>
      </Card>
    )
  }
)
DashboardOverviewCardV3.displayName = "DashboardOverviewCardV3"

function DashboardCardActionsDropdown({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu>) {
  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger
        aria-label="More actions"
        className={cn(
          "-mt-2 -me-2",
          buttonVariants({ variant: "ghost", size: "icon" })
        )}
      >
        <EllipsisVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {children ? (
          children
        ) : (
          <>
            {/* These items are just for showcase purposes. Use 'children' prop to add items. */}
            <DropdownMenuItem>Last week</DropdownMenuItem>
            <DropdownMenuItem disabled>Last month</DropdownMenuItem>
            <DropdownMenuItem>Last year</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export {
  DashboardCard,
  DashboardOverviewCard,
  DashboardOverviewCardV2,
  DashboardOverviewCardV3,
  DashboardCardActionsDropdown,
}
