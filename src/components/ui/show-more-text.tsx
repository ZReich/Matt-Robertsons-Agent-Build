"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export interface ShowMoreTextnProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  text: string;
  maxLength?: number;
  asChild?: boolean;
}

const ShowMoreText = React.forwardRef<HTMLParagraphElement, ShowMoreTextnProps>(
  ({ className, text, maxLength = 250, asChild = false, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const Comp = asChild ? Slot : "p";

    if (text.length > maxLength) {
      return (
        <Comp className={cn("text-base", className)} ref={ref} {...props}>
          {isExpanded ? text : `${text.slice(0, maxLength)}...`} <br />
          <Button
            variant="link"
            size="sm"
            className={cn("text-base p-0", className)}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Read less" : "Read more"}
          </Button>
        </Comp>
      );
    }

    return (
      <Comp className={cn("text-base", className)} ref={ref} {...props}>
        {text}
      </Comp>
    );
  }
);
ShowMoreText.displayName = "ShowMoreText";

export { ShowMoreText };
