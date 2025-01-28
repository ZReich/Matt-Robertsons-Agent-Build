import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

import type { VariantProps } from "class-variance-authority";
import { DynamicIconNameType } from "@/types";
import { DynamicIcon } from "../dynamic-icon";
import { Separator } from "./separator";

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
});

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
    );
  }
);
Timeline.displayName = "Timeline";

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
});

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
);
TimelineItem.displayName = "TimelineItem";

type TimelineDotStatus = "current" | "done" | "error";

interface TimelineDotPropsBase extends React.HTMLAttributes<HTMLDivElement> {
  status?: TimelineDotStatus;
  iconClassName?: string;
}

interface TimelineDotPropsWithCustom
  extends React.HTMLAttributes<HTMLDivElement> {
  customIconName: DynamicIconNameType;
  customStatusName: string;
  iconClassName?: string;
}

type TimelineDotProps = TimelineDotPropsBase | TimelineDotPropsWithCustom;

type StatusIconNamesType = Record<
  TimelineDotStatus,
  { iconName: DynamicIconNameType; className: string }
>;
const statusIconNames: StatusIconNamesType = {
  current: {
    iconName: "Circle",
    className: "fill-foreground text-foreground",
  },
  done: {
    iconName: "Check",
    className: "bg-primary text-primary-foreground",
  },
  error: {
    iconName: "X",
    className: "bg-destructive text-destructive-foreground",
  },
};

const TimelineDot = React.forwardRef<HTMLDivElement, TimelineDotProps>(
  ({ className, iconClassName, ...props }, ref) => {
    let statusIconName;
    let statusLabel;
    let statusClassName;
    if ("status" in props) {
      statusIconName = statusIconNames[props.status || "current"].iconName;
      statusClassName = statusIconNames[props.status || "current"].className;
      statusLabel = props.status;
    } else if ("customIconName" in props) {
      statusIconName = props.customIconName;
      statusLabel = props.customStatusName;
    }

    return (
      <div
        ref={ref}
        role="status"
        className={cn(
          "col-start-2 col-end-3 row-start-1 row-end-1 flex size-4 items-center justify-center rounded-full",
          className
        )}
        aria-label={statusLabel}
        {...props}
      >
        <DynamicIcon
          name={statusIconName || "Circle"}
          className={cn(
            "size-4 p-px text-muted-foreground rounded-full",
            statusClassName,
            iconClassName
          )}
        />
      </div>
    );
  }
);
TimelineDot.displayName = "TimelineDot";

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
});

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
);
TimelineContent.displayName = "TimelineContent";

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
);

interface TimelineHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof timelineHeadingVariants> {
  asChild?: boolean;
}

const TimelineHeading = React.forwardRef<
  HTMLHeadingElement,
  TimelineHeadingProps
>(({ className, side, variant, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "h3";
  return (
    <Comp
      ref={ref}
      className={cn(timelineHeadingVariants({ side, variant }), className)}
      {...props}
    />
  );
});
TimelineHeading.displayName = "TimelineHeading";

interface TimelineLineProps
  extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  done?: boolean;
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
  );
});
TimelineLine.displayName = "TimelineLine";

export {
  Timeline,
  TimelineDot,
  TimelineItem,
  TimelineContent,
  TimelineHeading,
  TimelineLine,
};
