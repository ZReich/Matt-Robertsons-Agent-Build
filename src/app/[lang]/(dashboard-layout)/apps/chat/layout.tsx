import { chatsData } from "./_data/chats";

import type { Metadata } from "next";

import { ChatProvider } from "./contexts/chat-context";
import { ChatSidebar } from "./_components/chat-sidebar";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Chat",
};

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider chatsData={chatsData}>
      <div className="container relative w-full flex gap-x-4 p-4">
        <ChatSidebar />
        {children}
      </div>
    </ChatProvider>
  );
}
