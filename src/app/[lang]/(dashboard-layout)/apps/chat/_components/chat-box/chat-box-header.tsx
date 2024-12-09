"use client";

import * as React from "react";
import { EllipsisVertical, Phone, Video } from "lucide-react";

import { getInitials } from "@/lib/utils";

import type { ChatType } from "../../types";

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

export function ChatBoxHeader({ chat }: { chat: ChatType }) {
  return (
    <CardHeader className="flex flex-row items-center space-y-0 gap-x-1.5 py-3 border-b border-border">
      <ChatAvatar
        src={chat.avatar}
        fallback={getInitials(chat.name)}
        status={chat.status}
        size={2}
      />
      <CardTitle>{chat.name}</CardTitle>
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
