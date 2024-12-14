import { MessageCircleDashed } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function ChatBoxPlaceholder() {
  return (
    <Card className="grow h-[calc(100vh-8.78rem)] md:h-auto">
      <CardContent className="size-full flex flex-col justify-center items-center gap-2 p-0">
        <MessageCircleDashed className="size-24 text-primary/50" />
        <p className="text-muted-foreground">
          Select a chat to start a conversation.
        </p>
      </CardContent>
    </Card>
  );
}
