// Refer to Emoji Mart README.md file for more details https://github.com/missive/emoji-mart
"use client"

import { useParams } from "next/navigation"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"
import { Smile } from "lucide-react"

import type { LocaleType } from "@/types"
import type { PickerProps } from "emoji-mart"

import { useSettings } from "@/hooks/use-settings"
import { buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function EmojiPicker(props: Omit<PickerProps, "data">) {
  const { settings } = useSettings()
  const params = useParams()

  const mode = settings.mode
  const locale = params.locale as LocaleType

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
  )
}
