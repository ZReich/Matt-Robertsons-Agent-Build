"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

type ProgressSegment = {
  value: number;
  color?: string;
};

type ProgressSegmentsProps = React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive.Root
> & {
  segments: ProgressSegment[];
  containerClassName?: string;
};

const ProgressSegments = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressSegmentsProps
>(({ containerClassName, segments, ...props }, ref) => {
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        containerClassName
      )}
    >
      {segments.map((segment, index) => (
        <ProgressPrimitive.Root
          key={segment.value + index}
          ref={ref}
          value={segment.value}
          {...props}
        >
          <ProgressPrimitive.Indicator
            style={{
              width: `${segment.value}%`,
              zIndex: segments.length - index,
              left: `${segments
                .slice(0, index)
                .reduce((acc, segment) => acc + segment.value, 0)}%`,
              backgroundColor: segment.color ?? "hsl(var(--primary))",
            }}
            className="absolute h-full transition-all"
          />
        </ProgressPrimitive.Root>
      ))}
    </div>
  );
});
ProgressSegments.displayName = "ProgressSegments";

export { Progress, ProgressSegments };
