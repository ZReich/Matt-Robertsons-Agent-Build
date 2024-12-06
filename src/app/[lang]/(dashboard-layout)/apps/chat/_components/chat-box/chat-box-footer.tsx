"use client";

import { useMedia } from "react-use";
import { ChevronRight, CirclePlus, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardFooter } from "@/components/ui/card";
import { TextMessageForm } from "./text-message-form";
import { ImagesUploader } from "./images-uploader";
import { FilesUploader } from "./files-uploader";

export function ChatBoxFooter() {
  const isMobile = useMedia("(max-width: 480px)");

  return (
    <CardFooter className="py-3 border-t border-border">
      {isMobile ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="More actions"
            >
              <CirclePlus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="flex justify-between gap-1.5 min-w-fit"
          >
            <DropdownMenuItem asChild>
              <ImagesUploader />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <FilesUploader />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Send a voice message"
              >
                <Mic className="size-4" />
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Collapsible className="flex whitespace-nowrap overflow-x-clip">
          <CollapsibleTrigger
            className="[&[data-state=open]>svg]:rotate-180"
            asChild
          >
            <Button variant="ghost" size="icon" aria-label="More actions">
              <ChevronRight className="size-4 transition-transform duration-200" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-left data-[state=open]:animate-collapsible-right duration-1000">
            <ImagesUploader />
            <FilesUploader />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Send a voice message"
            >
              <Mic className="size-4" />
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}
      <TextMessageForm />
    </CardFooter>
  );
}
