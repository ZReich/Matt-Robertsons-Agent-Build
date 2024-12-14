"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { MessageCircleX } from "lucide-react";

import { cn } from "@/lib/utils";

import type { UserType } from "../../types";

import { useSettings } from "@/hooks/use-settings";
import { useChatContext } from "../../hooks/use-chat-context";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollBar } from "@/components/ui/scroll-area";
import { ChatBoxFooter } from "./chat-box-footer";
import { ChatBoxHeader } from "./chat-box-header";
import { MessageBubble } from "./message-bubble";
import { ChatBoxPlaceholder } from "./chat-box-placeholder";
import { ChatBoxNotFound } from "./chat-box-not-found";

export function ChatBox({ user }: { user: UserType }) {
  const params = useParams();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const { chatState, handleSelectChat, handleSetUnreadCount } =
    useChatContext();
  const { settings } = useSettings();

  const chatIdParam = params.id?.[0]; // Get the chat ID from route params
  const chat = chatIdParam
    ? chatState.chats.find((c) => c.id === chatIdParam) // Find the chat by ID
    : null;
  const layout = settings.layout;

  // Synchronize chat selection and scroll to the bottom on updates
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }

    if (chat && chat !== chatState.selectedChat) {
      handleSelectChat(chat);
    }

    if (!!chat?.unreadCount) {
      handleSetUnreadCount();
    }
  }, [chat, chatState.selectedChat, handleSelectChat, handleSetUnreadCount]);

  // A map of chat users for quick lookup
  const userMap = React.useMemo(
    () => new Map(chat?.users.map((user) => [user.id, user])),
    [chat?.users]
  );

  // If no chat is selected, show a placeholder UI
  if (!chatIdParam) return <ChatBoxPlaceholder />;

  // If chat ID exists but no matching chat is found, show a not found UI
  if (!chat) return <ChatBoxNotFound />

  return (
    <Card className="grow grid">
      <ChatBoxHeader chat={chat} />
      <CardContent className="p-0">
        <ScrollAreaPrimitive.Root
          className={cn(
            "relative h-[calc(100vh-16.5rem)]",
            layout === "horizontal" && "md:h-[calc(100vh-20rem)]"
          )}
        >
          <ScrollAreaPrimitive.Viewport
            ref={scrollAreaRef}
            className="h-full w-full"
          >
            <ul className="flex flex-col-reverse gap-y-1.5 px-6 py-3">
              {chat.messages.map((message) => {
                const sender = userMap.get(message.senderId) as UserType;
                const isByCurrentUser = message.senderId === user.id;

                return (
                  <MessageBubble
                    key={message.id}
                    sender={sender}
                    message={message}
                    isByCurrentUser={isByCurrentUser}
                  />
                );
              })}
            </ul>
          </ScrollAreaPrimitive.Viewport>
          <ScrollBar orientation="vertical" />
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
      </CardContent>
      <ChatBoxFooter />
    </Card>
  );
}
