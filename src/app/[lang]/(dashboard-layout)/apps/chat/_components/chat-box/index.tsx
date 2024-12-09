"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { MessageCircleDashed } from "lucide-react";

import { useChatContext } from "../../hooks/use-chat-context";

import type { UserType } from "../../types";

import { useSettings } from "@/hooks/use-settings";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollBar } from "@/components/ui/scroll-area";
import { ChatBoxFooter } from "./chat-box-footer";
import { ChatBoxHeader } from "./chat-box-header";
import { MessageBubble } from "./message-bubble";
import { cn } from "@/lib/utils";

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
  if (!chatIdParam) {
    return (
      <Card className="grow h-[calc(100vh-8.78rem)] md:h-auto">
        <CardContent className="size-full flex flex-col justify-center items-center gap-2 p-0">
          <MessageCircleDashed className="size-24 text-primary/50" />
          <span className="text-muted-foreground">
            Select a chat to start a conversation.
          </span>
        </CardContent>
      </Card>
    );
  }

  // If chat ID exists but no matching chat is found, throw an error
  if (!chat) throw new Error("This chat does not exist");

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
