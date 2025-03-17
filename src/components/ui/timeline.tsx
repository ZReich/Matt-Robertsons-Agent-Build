import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import type { DynamicIconNameType } from "@/types"
import type * as SeparatorPrimitive from "@radix-ui/react-separator"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

import { DynamicIcon } from "../dynamic-icon"
import { Separator } from "./separator"

const timelineVariants = cva("grid", {
  variants: {
    align: {
      left: "[&>li]:grid-cols-[0_min-content_1fr]",
      right: "[&>li]:grid-cols-[1fr_min-content]",
      center: "[&>li]:grid-cols-[1fr_min-content_1fr]",
    },
  },
  defaultVariants: {
    align: "left",
  },
})

interface TimelineProps
  extends React.HTMLAttributes<HTMLUListElement>,
    VariantProps<typeof timelineVariants> {}

const Timeline = React.forwardRef<HTMLUListElement, TimelineProps>(
  ({ children, className, align, ...props }, ref) => {
    return (
      <ul
        className={cn(timelineVariants({ align }), className)}
        ref={ref}
        {...props}
      >
        {children}
      </ul>
    )
  }
)
Timeline.displayName = "Timeline"

const timelineItemVariants = cva("grid items-center gap-x-2", {
  variants: {
    status: {
      done: "text-foreground",
      default: "text-muted-foreground",
    },
  },
  defaultVariants: {
    status: "default",
  },
})

interface TimelineItemProps
  extends React.HTMLAttributes<HTMLLIElement>,
    VariantProps<typeof timelineItemVariants> {}

const TimelineItem = React.forwardRef<HTMLLIElement, TimelineItemProps>(
  ({ className, status, ...props }, ref) => (
    <li
      className={cn(timelineItemVariants({ status }), className)}
      ref={ref}
      {...props}
    />
  )
)
TimelineItem.displayName = "TimelineItem"

type TimelineDotStatus = "current" | "done" | "error"
interface TimelineDotPropsBase extends React.HTMLAttributes<HTMLDivElement> {
  iconClassName?: string
}

interface TimelineDotPropsWithStatus extends TimelineDotPropsBase {
  status?: TimelineDotStatus
  customIconName?: never
  customStatusName?: never
}

interface TimelineDotPropsWithCustom extends TimelineDotPropsBase {
  status?: never
  customIconName: DynamicIconNameType
  customStatusName: string
}

type TimelineDotProps = TimelineDotPropsWithStatus | TimelineDotPropsWithCustom

type StatusIconNamesType = Record<
  TimelineDotStatus,
  { iconName: DynamicIconNameType; className: string }
>

const statusIconNames: StatusIconNamesType = {
  current: {
    iconName: "Circle",
    className: "fill-foreground text-foreground rounded-full",
  },
  done: {
    iconName: "Check",
    className: "bg-primary text-primary-foreground p-0.5 rounded-full",
  },
  error: {
    iconName: "X",
    className: "bg-destructive text-destructive-foreground p-0.5 rounded-full",
  },
}

const TimelineDot = React.forwardRef<HTMLDivElement, TimelineDotProps>(
  (
    {
      className,
      iconClassName,
      status = "current",
      customIconName,
      customStatusName,
      ...props
    },
    ref
  ) => {
    let statusIconName = statusIconNames["current"].iconName
    let statusLabel = "current"
    let statusClassName

    // Determines if the component uses predefined statuses or custom ones
    if (customStatusName && customIconName) {
      // If a custom icon is provided, use it along with the custom status label
      statusIconName = customIconName
      statusLabel = customStatusName
    } else if (status) {
      // If the "status" prop exists, use the corresponding predefined icon and styling
      statusIconName = statusIconNames[status].iconName
      statusClassName = statusIconNames[status].className
      statusLabel = status // Assigns the status label for accessibility
    }

    return (
      <div
        ref={ref}
        role="status"
        className={cn(
          "col-start-2 col-end-3 row-start-1 row-end-1 flex justify-center items-center rounded-md",
          className
        )}
        aria-label={statusLabel}
        {...props}
      >
        <DynamicIcon
          name={statusIconName}
          className={cn(
            "size-4 text-muted-foreground",
            statusClassName,
            iconClassName
          )}
        />
      </div>
    )
  }
)
TimelineDot.displayName = "TimelineDot"

const timelineContentVariants = cva("row-start-2 row-end-2 pb-8", {
  variants: {
    side: {
      start: "col-start-3 col-end-4 me-auto text-start",
      end: "col-start-1 col-end-2 ms-auto text-end",
    },
  },
  defaultVariants: {
    side: "start",
  },
})

interface TimelineContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof timelineContentVariants> {}

const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, side, ...props }, ref) => (
    <div
      className={cn(timelineContentVariants({ side }), className)}
      ref={ref}
      {...props}
    />
  )
)
TimelineContent.displayName = "TimelineContent"

const timelineHeadingVariants = cva(
  "row-start-1 row-end-1 line-clamp-1 max-w-full truncate",
  {
    variants: {
      side: {
        start: "col-start-3 col-end-4 me-auto text-start",
        end: "col-start-1 col-end-2 ms-auto text-end",
      },
      variant: {
        primary: "text-base font-medium text-foreground",
        secondary: "text-sm font-light text-muted-foreground",
      },
    },
    defaultVariants: {
      side: "start",
      variant: "primary",
    },
  }
)

interface TimelineHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof timelineHeadingVariants> {
  asChild?: boolean
}

const TimelineHeading = React.forwardRef<
  HTMLHeadingElement,
  TimelineHeadingProps
>(({ className, side, variant, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "h3"
  return (
    <Comp
      ref={ref}
      className={cn(timelineHeadingVariants({ side, variant }), className)}
      {...props}
    />
  )
})
TimelineHeading.displayName = "TimelineHeading"

interface TimelineLineProps
  extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  done?: boolean
}
const TimelineLine = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  TimelineLineProps
>(({ className, done = false, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      orientation="vertical"
      className={cn(
        "col-start-2 col-end-3 row-start-2 row-end-2 bg-muted-foreground mx-auto w-[0.094rem]",
        done && "bg-foreground",
        className
      )}
      {...props}
    />
  )
})
TimelineLine.displayName = "TimelineLine"

export {
  Timeline,
  TimelineDot,
  TimelineItem,
  TimelineContent,
  TimelineHeading,
  TimelineLine,
}
