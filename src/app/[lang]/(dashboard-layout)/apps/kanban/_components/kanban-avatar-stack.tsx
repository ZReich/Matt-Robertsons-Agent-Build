"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface AvatarStackProps extends React.HTMLAttributes<HTMLDivElement> {
  avatars: { src?: string; alt: string; href?: string }[];
  limit?: number;
  size?: number;
}

const KanbanAvatarStack = React.memo(
  ({
    avatars,
    limit = 4,
    size = 14,
    className,
    ...props
  }: AvatarStackProps) => {
    const limitedAvatars = avatars.slice(0, limit);

    return (
      <div className={cn("flex -space-x-2.5", className)} {...props}>
        {limitedAvatars.slice(0, limit).map((avatar) => (
          <TooltipProvider
            key={`${avatar.alt}-${avatar.src}`}
            delayDuration={200}
          >
            <Tooltip>
              <TooltipTrigger>
                {avatar.href ? (
                  <Link href={avatar.href}>
                    <Avatar
                      className={`size-${size} transition duration-300 hover:scale-105 hover:z-10`}
                    >
                      <AvatarImage src={avatar.src} />
                      <AvatarFallback>
                        {avatar.alt
                          .split(" ")
                          .reduce((acc, subName) => acc + subName[0], "")}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar
                    className={`size-${size} transition duration-300 hover:scale-105 hover:z-10`}
                  >
                    <AvatarImage src={avatar.src} />
                    <AvatarFallback>
                      {avatar.alt
                        .split(" ")
                        .reduce((acc, subName) => acc + subName[0], "")}
                    </AvatarFallback>
                  </Avatar>
                )}
              </TooltipTrigger>
              <TooltipContent className="capitalize -me-[1.23rem]">
                <p>{avatar.alt}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {limitedAvatars.length < avatars.length && (
          <Avatar
            className={`size-${size} transition duration-300 cursor-pointer hover:scale-105 hover:z-10`}
          >
            <AvatarFallback>
              +{avatars.length - limitedAvatars.length}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }
);
KanbanAvatarStack.displayName = "KanbanAvatarStack";

export { KanbanAvatarStack };
