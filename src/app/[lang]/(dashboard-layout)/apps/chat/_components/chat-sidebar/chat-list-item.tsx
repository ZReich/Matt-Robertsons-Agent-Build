import Link from "next/link";
import { useParams } from "next/navigation";

import { cn, getInitials, formatDistance } from "@/lib/utils";
import { ensureLocalizedPathname } from "@/lib/i18n";

import type { ChatType } from "../../types";
import type { LocaleType } from "@/configs/i18n";

import { useChatContext } from "../../hooks/use-chat-context";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChatAvatar } from "../chat-avatar";

export function ChatListItem({ chat }: { chat: ChatType }) {
  const { setIsChatSidebarOpen } = useChatContext();
  const params = useParams();

  const chatIdParam = params.id?.[0];
  const locale = params.lang as LocaleType;

  return (
    <Link
      href={ensureLocalizedPathname(`/apps/chat/${chat.id}`, locale)}
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
              {formatDistance(chat.lastMessage?.createdAt ?? new Date())}
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
