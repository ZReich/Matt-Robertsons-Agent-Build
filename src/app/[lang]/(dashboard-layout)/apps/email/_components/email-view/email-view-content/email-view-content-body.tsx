"use client";

import { cn } from "@/lib/utils";

import type { EmailType } from "../../../types";

import { useSettings } from "@/hooks/use-settings";

import { CardContent } from "@/components/ui/card";

import { ScrollArea } from "@/components/ui/scroll-area";

export function EmailViewContentBody({ email }: { email: EmailType }) {
  const { settings } = useSettings();

  const layout = settings.layout;

  return (
    <ScrollArea
      className={cn(
        "h-[calc(100vh-20.7rem)]",
        layout === "horizontal" && "md:h-[calc(100vh-24.3rem)]"
      )}
    >
      <CardContent className="whitespace-pre-wrap">{email.content}</CardContent>
    </ScrollArea>
  );
}
