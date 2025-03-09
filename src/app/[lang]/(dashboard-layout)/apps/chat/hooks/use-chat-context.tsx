"use client"

import * as React from "react"

import { ChatContext } from "../contexts/chat-context"

export function useChatContext() {
  const context = React.useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider")
  }
  return context
}
