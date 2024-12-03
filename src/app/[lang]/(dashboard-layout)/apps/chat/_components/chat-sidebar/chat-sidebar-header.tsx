"use client";

import * as React from "react";

import {
  Bell,
  CircleDashed,
  ListFilter,
  MoreVertical,
  Search,
  SquarePen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardHeader } from "@/components/ui/card";

export function ChatSidebarHeader() {
  const [notifications, setNotifications] = React.useState("ALL_MESSAGES");
  const [status, setStatus] = React.useState("ONLINE");

  return (
    <CardHeader className="flex flex-row items-center space-y-0 gap-x-1.5 p-3 border-b border-border">
      <div className="grow flex justify-between items-center gap-2">
        <div className="relative grow">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            className="w-full bg-accent shadow-none ps-8 pe-4"
            placeholder="Search..."
            type="search"
          />
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="More options">
            <SquarePen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Filter chat list by">
            <ListFilter className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Notifications</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={notifications}
                    onValueChange={setNotifications}
                  >
                    <DropdownMenuRadioItem value="ALL_MESSAGES">
                      All Messages
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="ONLY_MENTIONS">
                      Only @mentions
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="NOTHING">
                      Nothing
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CircleDashed className="mr-2 h-4 w-4" />
                  <span>Status</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={status}
                    onValueChange={setStatus}
                  >
                    <DropdownMenuRadioItem value="ONLINE">
                      Online
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="IDLE">
                      Idle
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="DO_NOT_DISTURB">
                      Do Not Disturb
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="INVISIBLE">
                      Invisible
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CardHeader>
  );
}
