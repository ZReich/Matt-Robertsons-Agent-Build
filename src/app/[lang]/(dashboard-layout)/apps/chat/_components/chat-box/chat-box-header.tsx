"use client";

import * as React from "react";
import { EllipsisVertical, Phone, Video } from "lucide-react";

import { getInitials } from "@/lib/utils";

import type { ChatType, UserType } from "../../types";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatAvatar } from "../chat-avatar";

export function ChatBoxHeader({
  chat,
  user,
}: {
  chat: ChatType;
  user: UserType;
}) {
  let info;

  if (chat?.chatGroup) {
    info = {
      name: chat.chatGroup.name,
      avatar: chat.chatGroup.avatar,
    };
  } else {
    const againstUser = chat?.users.find((u) => u.id !== user.id) as UserType;

    info = {
      name: againstUser.name,
      avatar: againstUser.avatar,
      status: againstUser.status,
    };
  }

  return (
    <CardHeader className="flex flex-row items-center space-y-0 gap-x-1.5 py-3 border-b border-border">
      <ChatAvatar
        src={info.avatar}
        fallback={getInitials(info.name)}
        status={info.status as string | undefined}
        size={2}
      />
      <CardTitle>{info.name}</CardTitle>
      <div className="flex gap-1 ms-auto">
        <Button variant="ghost" size="icon">
          <Phone className="size-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Video className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="self-center" asChild>
            <Button variant="ghost" size="icon">
              <EllipsisVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Search</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Report
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Mute
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardHeader>
  );
}
