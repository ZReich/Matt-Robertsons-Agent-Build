import { EllipsisVertical } from "lucide-react";

import { formatDistanceToNow } from "@/lib/date-formatters";
import { cn, getInitials } from "@/lib/utils";

import { MessageType, UserType } from "../../../types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChatAvatar } from "../../chat-avatar";
import { MessageStatusIcon } from "./message-status-icon";
import { MessageBubbleContent } from "./message-bubble-content";

export function MessageBubble({
  sender,
  message,
  isByCurrentUser,
}: {
  sender: UserType;
  message: MessageType;
  isByCurrentUser: boolean;
}) {
  return (
    <li className={cn("flex gap-2", isByCurrentUser && "flex-row-reverse")}>
      <ChatAvatar
        src={sender.avatar}
        fallback={getInitials(sender.name)}
        status={sender.status}
        size={1.75}
        className="shrink-0"
      />
      <div className="flex flex-col gap-1 w-full max-w-[320px]">
        <span
          className={cn(
            "text-sm font-semibold text-foreground",
            isByCurrentUser && "text-end"
          )}
        >
          {sender.name}
        </span>
        <MessageBubbleContent
          message={message}
          isByCurrentUser={isByCurrentUser}
        />
        <div className="flex items-center gap-1">
          <span className="text-sm font-normal text-muted-foreground">
            {formatDistanceToNow(message.createdAt)}
          </span>
          {isByCurrentUser && <MessageStatusIcon status={message.status} />}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="self-center" asChild>
          <Button variant="ghost" size="icon">
            <EllipsisVertical className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Reply</DropdownMenuItem>
          <DropdownMenuItem>Forward</DropdownMenuItem>
          <DropdownMenuItem>Copy</DropdownMenuItem>
          <DropdownMenuSeparator />
          {!isByCurrentUser && (
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Report
            </DropdownMenuItem>
          )}
          {isByCurrentUser && (
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
