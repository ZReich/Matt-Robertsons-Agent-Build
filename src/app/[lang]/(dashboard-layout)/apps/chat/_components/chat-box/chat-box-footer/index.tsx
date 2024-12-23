"use client";

import { CardFooter } from "@/components/ui/card";
import { TextMessageForm } from "../text-message-form";
import { ChatBoxFooterActions } from "./chat-box-footer-actions";

export function ChatBoxFooter() {
  return (
    <CardFooter className="py-3 border-t border-border">
      <ChatBoxFooterActions />
      <TextMessageForm />
    </CardFooter>
  );
}
