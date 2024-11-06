import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";

import { MessageType } from "../../../types";

import { Button } from "@/components/ui/button";
import { FileThumbnail } from "@/components/file-thumbnail";

export function MessageBubbleContent({
  message,
  isByCurrentUser,
}: {
  message: MessageType;
  isByCurrentUser: boolean;
}) {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // Regex to match URLs

  // Function to replace URLs with anchor tags
  const renderMessageWithLinks = (text: string) => {
    if (!text) return null;

    // Split text on the URL regex
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      // If the part matches the URL regex, return an anchor tag
      if (urlRegex.test(part)) {
        return (
          <Link
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {part}
          </Link>
        );
      }
      // Otherwise, return the plain text part
      return part;
    });
  };

  let content: React.ReactNode;

  if (message.text) {
    content = <p className="p-2">{renderMessageWithLinks(message.text)}</p>;
  } else if (message.images) {
    content = (
      <div
        className={cn(
          "grid gap-2 rounded-lg",
          message.images.length > 1 && "grid-cols-2"
        )}
      >
        {message.images.slice(0, 4).map((image, index) => (
          <div key={image.id} className="relative" aria-label="images">
            <Link href="" className="block size-full aspect-square">
              <Image
                src={image.url}
                alt={image.name}
                className="object-cover rounded-lg"
                fill
              />
            </Link>
            {index === 3 && message.images && message.images.length > 4 && (
              <Link
                href=""
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-2xl text-white rounded-lg hover:bg-opacity-75"
              >
                <span>+{message.images.length - 4}</span>
                <span className="sr-only">more images</span>
              </Link>
            )}
          </div>
        ))}
      </div>
    );
  } else if (message.files) {
    content = message.files.map((file) => (
      <div
        key={file.id}
        className="flex justify-between items-center bg-muted-foreground/40 p-4 rounded-lg break-all"
        aria-label="File"
      >
        <FileThumbnail fileName={file.name} />
        <div className="flex-1 grid mx-2 truncate">
          <span className="truncate">{file.name}</span>
          <span className="text-xs truncate">{formatFileSize(file.size)}</span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Dowmload">
          <Download className="size-4" />
        </Button>
      </div>
    ));
  } else if (message.voiceMessage) {
    content = <audio controls src={message.voiceMessage.url} />;
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
  );
}
