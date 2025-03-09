import { userData } from "@/data/user"

import { ChatBox } from "../_components/chat-box"
import { ChatBoxPlaceholder } from "../_components/chat-box/chat-box-placeholder"

export default function ChatBoxPage({ params }: { params: { id: string[] } }) {
  const chatIdParam = params.id?.[0]

  // If no chat is selected, show a placeholder UI
  if (!chatIdParam) return <ChatBoxPlaceholder />

  // Otherwize show a chat box
  return <ChatBox user={userData} />
}
