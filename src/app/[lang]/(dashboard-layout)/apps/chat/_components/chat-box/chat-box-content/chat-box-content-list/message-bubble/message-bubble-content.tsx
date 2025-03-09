import type { MessageType } from "../../../../../types"

import { cn } from "@/lib/utils"

import { FilesMessageBubbleContent } from "./files-message-bubble-content"
import { ImagesMessageBubbleContent } from "./images-message-bubble-content"
import { TextMessageBubbleContent } from "./text-message-bubble-content"

export function MessageBubbleContent({
  message,
  isByCurrentUser,
}: {
  message: MessageType
  isByCurrentUser: boolean
}) {
  let content: React.ReactNode

  // Handle different types of message content
  if (message.text) {
    content = <TextMessageBubbleContent text={message.text} />
  } else if (message.images) {
    content = <ImagesMessageBubbleContent images={message.images} />
  } else if (message.files) {
    content = (
      <FilesMessageBubbleContent
        files={message.files}
        isByCurrentUser={isByCurrentUser}
      />
    )
  } else if (message.voiceMessage) {
    content = <audio controls src={message.voiceMessage.url} />
  }

  return (
    <div
      className={cn(
        "text-sm text-accent-foreground bg-accent p-2 space-y-2 rounded-lg break-all",
        isByCurrentUser
          ? "bg-primary text-primary-foreground rounded-se-none"
          : "rounded-ss-none"
      )}
    >
      {content}
    </div>
  )
}
