"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cva } from "class-variance-authority";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

import type { VariantProps } from "class-variance-authority";

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
        secondary: "text-secondary",
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

interface RatingsProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
    VariantProps<typeof starVariants> {
  length?: number;
}

export const Ratings = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RatingsProps
>(
  (
    {
      className,
      length = 5,
      size,
      variant = "default",
      orientation = "horizontal",
      ...props
    },
    ref
  ) => {
    const currentValue = props.value || "0";
    const [hoverValue, onHoverValue] = React.useState(currentValue);

    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "space-x-1.5" : "flex-col space-y-1.5",
          className
        )}
        orientation={orientation}
        onMouseLeave={() => onHoverValue("0")}
        aria-label="Rating"
        {...props}
      >
        {Array.from({ length }).map((_, index) => {
          const itemValue = (index + 1).toString();
          const filled =
            Number(itemValue) <= (Number(hoverValue) || Number(currentValue));

          return (
            <RatingsStar
              key={index}
              variant={variant}
              size={size}
              filled={filled}
              value={itemValue}
              onHoverValue={onHoverValue}
            />
          );
        })}
      </RadioGroupPrimitive.Root>
    );
  }
);
Ratings.displayName = "Ratings";

interface RatingsStarProps
  extends RadioGroupPrimitive.RadioGroupItemProps,
    VariantProps<typeof starVariants> {
  onHoverValue: (rating: string) => void;
}

const RatingsStar = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RatingsStarProps
>(({ value, size, variant, filled, onHoverValue, ...props }, ref) => {
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
      <Star className="h-full w-full fill-current" />
    </RadioGroupPrimitive.Item>
  );
});
RatingsStar.displayName = "RatingsStar";
