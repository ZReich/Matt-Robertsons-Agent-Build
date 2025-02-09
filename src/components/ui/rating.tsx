"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import type { VariantProps } from "class-variance-authority";
import type { DynamicIconNameType } from "@/types";

import { DynamicIcon } from "../dynamic-icon";

const starVariants = cva(
  "transition-all duration-100 ease-in-out hover:scale-110",
  {
    variants: {
      size: {
        sm: "w-4 h-4",
        default: "w-6 h-6",
        lg: "w-8 h-8",
      },
      variant: {
        default: "text-yellow-400",
        primary: "text-primary",
        muted: "text-muted-foreground",
      },
      filled: {
        true: "",
        false: "text-gray-200",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
      filled: false,
    },
  }
);

export interface RatingProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
    VariantProps<typeof starVariants> {
  length?: number;
  readOnly?: boolean;
  iconName?: DynamicIconNameType;
}

export const Rating = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RatingProps
>(
  (
    {
      className,
      length = 5,
      size,
      variant = "default",
      orientation = "horizontal",
      readOnly = false,
      iconName = "Star",
      ...props
    },
    ref
  ) => {
    const currentValue = props.value || "0";
    const [hoverValue, onHoverValue] = React.useState(currentValue);

    if (readOnly) {
      return (
        <div
          ref={ref}
          role="img"
          className={cn(
            "flex",
            orientation === "horizontal" ? "gap-x-1.5" : "flex-col space-y-1.5",
            className
          )}
          aria-label={`Rating: ${currentValue} out of ${length}`}
          {...props}
        >
          {Array.from({ length }, (_, index) => {
            const starValue = (index + 1).toString();
            const filled = Number(starValue) <= Number(currentValue);

            return (
              <DynamicIcon
                key={starValue}
                name={iconName}
                className={cn(
                  starVariants({ size, variant, filled }),
                  "fill-current"
                )}
                aria-hidden
              />
            );
          })}
        </div>
      );
    }

    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "gap-x-1.5" : "flex-col space-y-1.5",
          className
        )}
        orientation={orientation}
        onMouseLeave={() => onHoverValue("0")}
        aria-label="Rating"
        {...props}
      >
        {Array.from({ length }).map((_, index) => {
          const starValue = (index + 1).toString();
          const filled =
            Number(starValue) <= (Number(hoverValue) || Number(currentValue));

          return (
            <RatingStar
              key={starValue}
              variant={variant}
              size={size}
              filled={filled}
              value={starValue}
              onHoverValue={onHoverValue}
              iconName={iconName}
            />
          );
        })}
      </RadioGroupPrimitive.Root>
    );
  }
);
Rating.displayName = "Rating";

export interface RatingStarProps
  extends RadioGroupPrimitive.RadioGroupItemProps,
    VariantProps<typeof starVariants> {
  onHoverValue: (rating: string) => void;
  iconName: DynamicIconNameType;
}

const RatingStar = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RatingStarProps
>(({ value, size, variant, filled, onHoverValue, iconName, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      value={value}
      className={cn(
        starVariants({ size, variant, filled }),
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      )}
      onMouseEnter={() => onHoverValue(value)}
      aria-label={`Rate ${value} star${value === "1" ? "" : "s"}`}
      {...props}
    >
      <DynamicIcon name={iconName} className="h-full w-full fill-current" />
    </RadioGroupPrimitive.Item>
  );
});
RatingStar.displayName = "RatingStar";
