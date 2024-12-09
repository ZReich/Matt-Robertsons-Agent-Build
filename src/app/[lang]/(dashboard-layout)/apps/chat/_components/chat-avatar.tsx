"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { cn } from "@/lib/utils";

import { UserStatusIcon } from "./user-status-icon";

const ChatAvatar = React.memo(
  ({
    src,
    fallback,
    status,
    size = 2,
    className,
  }: {
    src?: string;
    fallback: string;
    status?: string;
    size: number;
    className?: string;
  }) => {
    return (
      <div
        style={{
          height: size + "rem",
          width: size + "rem",
        }}
        className={cn(
          "relative bg-background ring-2 ring-background rounded-full",
          className
        )}
      >
        <Avatar
          style={{
            height: size + "rem",
            width: size + "rem",
            fontSize: size / 2.5 + "rem", // Font size of fallback text scales proportionally to the avatar size
          }}
        >
          <AvatarImage src={src} alt="Avatar" />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>

        {/* Display the user status icon only if the `status` prop is provided */}
        {status && (
          <div className="absolute bottom-0 end-0 bg-inherit ring-1 ring-inherit rounded-full z-10">
            <UserStatusIcon
              status={status}
              size={size * 5} // Dynamically scale the status icon size to be proportional to the avatar size
            />
          </div>
        )}
      </div>
    );
  }
);
ChatAvatar.displayName = "ChatAvatar";

export { ChatAvatar };
