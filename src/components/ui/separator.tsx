"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

const SeparatorWithText = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, children },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex justify-between items-center",
        orientation === "horizontal" ? "h-full" : "flex-col h-full",
        className
      )}
    >
      <Separator
        decorative={decorative}
        orientation={orientation}
        className="shrink"
      />
      <span
        className={cn(
          "shrink-0 px-2 text-xs text-muted-foreground uppercase",
          orientation === "vertical" && "-rotate-90 rtl:rotate-90"
        )}
      >
        {children}
      </span>
      <Separator
        decorative={decorative}
        orientation={orientation}
        className="shrink"
      />
    </div>
  )
);
SeparatorWithText.displayName = "SeparatorWithText";

export { Separator, SeparatorWithText };
