import Link from "next/link";

import { formatDistanceToNow } from "@/lib/date-formatters";
import { cn, getInitials } from "@/lib/utils";

import { ChatType } from "../../types";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChatAvatar } from "../chat-avatar";

export function ChatListItem({
  chat,
  chatIdParam,
  setIsChatSidebarOpen,
}: {
  chat: ChatType;
  chatIdParam: string;
  setIsChatSidebarOpen: (val: boolean) => void;
}) {
  return (
    <Link
      href={`/apps/chat/${chat.id}`}
      prefetch={false}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        chatIdParam === chat.id && "bg-accent",
        "h-fit w-full"
      )}
      onClick={() => setIsChatSidebarOpen(false)}
    >
      <li className="w-full flex items-center gap-2">
        <ChatAvatar
          src={chat.avatar}
          fallback={getInitials(chat.name)}
          status={chat.status}
          size={1.75}
          className="shrink-0"
        />
        <div className="h-11 w-full grid grid-cols-3 gap-x-2">
          <div className="col-span-2 grid">
            <span className="truncate">{chat.name}</span>
            <span className="text-xs text-muted-foreground truncate">
              {chat.lastMessage?.content || "No messages yet..."}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(chat.lastMessage?.createdAt ?? new Date())}
            </span>
            {!!chat?.unreadCount && (
              <Badge className="hover:bg-primary">{chat.unreadCount}</Badge>
            )}
          </div>
        </div>
      </li>
    </Link>
  );
}
