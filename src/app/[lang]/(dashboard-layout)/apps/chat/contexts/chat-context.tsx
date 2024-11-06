"use client";

import * as React from "react";

import { ChatReducer } from "../reducers/chat-reducer";

import { ChatContextType, ChatType } from "../types";

export const ChatContext = React.createContext<ChatContextType | undefined>(
  undefined
);

export function ChatProvider({
  chatsData,
  children,
}: {
  chatsData: ChatType[];
  children: React.ReactNode;
}) {
  const [chatState, dispatch] = React.useReducer(ChatReducer, {
    chats: chatsData,
    selectedChat: null,
  });
  const [open, setOpen] = React.useState(false);

  const handleSelectChat = (chat: ChatType) => {
    dispatch({ type: "selectChat", chat });
  };

  const handleAddTextMessage = (text: string) => {
    dispatch({ type: "addTextMessage", text });
  };

  const handleAddImagesMessage = (images: File[]) => {
    dispatch({ type: "addImagesMessage", images });
  };

  const handleAddFilesMessage = (files: File[]) => {
    dispatch({ type: "addFilesMessage", files });
  };

  const handleSetUnreadCount = () => {
    dispatch({ type: "setUnreadCount" });
  };

  return (
    <ChatContext.Provider
      value={{
        chatState,
        isChatSidebarOpen: open,
        setIsChatSidebarOpen: setOpen,
        handleSelectChat,
        handleAddTextMessage,
        handleAddImagesMessage,
        handleAddFilesMessage,
        handleSetUnreadCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
