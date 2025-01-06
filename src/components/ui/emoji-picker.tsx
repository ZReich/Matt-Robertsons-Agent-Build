"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { Smile } from "lucide-react";

import { useSettings } from "@/hooks/use-settings";

import type { PickerProps } from "emoji-mart";
import type { LocaleType } from "@/types";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";

export function EmojiPicker(props: Omit<PickerProps, "data">) {
  const { settings } = useSettings();
  const params = useParams();

  const mode = settings.mode;
  const locale = params.locale as LocaleType;

  return (
    <Popover>
      <PopoverTrigger
        className={buttonVariants({ variant: "ghost", size: "icon" })}
        aria-label="Emoji"
      >
        <Smile className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="start">
        <Picker
          theme={mode === "system" ? "auto" : mode}
          locale={locale}
          previewPosition="none"
          icons="outline"
          emojiSize={16}
          emojiButtonRadius={`${settings.radius}rem`}
          autoFocus
          {...props}
          data={data}
        />
      </PopoverContent>
    </Popover>
  );
}
