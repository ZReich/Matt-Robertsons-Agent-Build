"use client"

import * as React from "react"
import Link from "next/link"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva } from "class-variance-authority"

import type { VariantProps } from "class-variance-authority"

import { cn, getInitials } from "@/lib/utils"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-lg",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-lg bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

const avatarStackVariants = cva(
  "transition duration-300 hover:scale-105 hover:z-10",
  {
    variants: {
      size: {
        default: "h-10 w-10",
        sm: "h-9 w-9 text-xs",
        lg: "h-11 w-11",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export interface AvatarStackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarStackVariants> {
  avatars: { src?: string; alt: string; href?: string }[]
  limit?: number
  onMoreButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

const AvatarStack = React.memo(
  ({
    avatars,
    limit = 4,
    size,
    onMoreButtonClick,
    className,
    ...props
  }: AvatarStackProps) => {
    const limitedAvatars = avatars.slice(0, limit)
    const remainingCount = avatars.length - limitedAvatars.length

    return (
      <div className={cn("flex", className)} {...props}>
        {limitedAvatars.slice(0, limit).map((avatar) => (
          <TooltipProvider
            key={`${avatar.alt}-${avatar.src}`}
            delayDuration={200}
          >
            <Tooltip>
              <TooltipTrigger className="-ms-1 -me-1">
                {avatar.href ? (
                  <Link href={avatar.href}>
                    <Avatar className={avatarStackVariants({ size })}>
                      <AvatarImage src={avatar.src} />
                      <AvatarFallback>{getInitials(avatar.alt)}</AvatarFallback>
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar className={avatarStackVariants({ size })}>
                    <AvatarImage src={avatar.src} />
                    <AvatarFallback>{getInitials(avatar.alt)}</AvatarFallback>
                  </Avatar>
                )}
              </TooltipTrigger>
              <TooltipContent className="capitalize -me-[1.23rem]">
                <p>{avatar.alt}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

        {/* Show "+N" button if avatars exceed the limit */}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={onMoreButtonClick}
            className="-ms-1 -me-1"
            aria-label="Show more"
          >
            <Avatar className={avatarStackVariants({ size })}>
              <AvatarFallback>+{remainingCount}</AvatarFallback>
            </Avatar>
          </button>
        )}
      </div>
    )
  }
)
AvatarStack.displayName = "AvatarStack"

export { Avatar, AvatarImage, AvatarFallback, AvatarStack }
