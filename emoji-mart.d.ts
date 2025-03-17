declare module "emoji-mart" {
  interface Emoji {
    id: string
    name: string
    native: string
    unified: string
    shortcodes: string
    keywords: string[]
  }

  interface I18n {
    rtl?: boolean
    search?: string
    search_no_results_1?: string
    search_no_results_2?: string
    pick?: string
    add_custom?: string
    categories?: {
      [key: string]: string
    }
    skins?: {
      choose?: string
      [key: string]: string
    }
  }

  interface PickerProps {
    autoFocus?: boolean
    dynamicWidth?: boolean
    emojiButtonColors?: string | null
    emojiButtonRadius?: string
    emojiButtonSize?: number
    emojiSize?: number
    emojiVersion?: 1 | 2 | 3 | 4 | 5 | 11 | 12 | 12.1 | 13 | 13.1 | 14 | 15
    exceptEmojis?: string[]
    icons?: "auto" | "outline" | "solid"
    locale?:
      | "en"
      | "ar"
      | "be"
      | "cs"
      | "de"
      | "es"
      | "fa"
      | "fi"
      | "fr"
      | "hi"
      | "it"
      | "ja"
      | "ko"
      | "nl"
      | "pl"
      | "pt"
      | "ru"
      | "sa"
      | "tr"
      | "uk"
      | "vi"
      | "zh"
    maxFrequentRows?: number
    navPosition?: "top" | "bottom" | "none"
    noCountryFlags?: boolean
    noResultsEmoji?: string | null
    perLine?: number
    previewEmoji?: string | null
    previewPosition?: "top" | "bottom" | "none"
    searchPosition?: "sticky" | "static" | "none"
    set?: "native" | "apple" | "facebook" | "google" | "twitter"
    skin?: 1 | 2 | 3 | 4 | 5 | 6
    skinTonePosition?: "preview" | "search" | "none"
    theme?: "auto" | "light" | "dark"
    categories?: Array<{ id: string; name: string; emojis: string[] }>
    categoryIcons?: Record<string, string>
    custom?: Emoji[]
    data: Data
    i18n?: I18n
    getImageURL?: (emoji: Emoji) => string
    getSpritesheetURL?: (set: string, emojiSize: number) => string
    onAddCustomEmoji?: (emoji: Emoji) => void
    onClickOutside?: (event: MouseEvent) => void
    onEmojiSelect?: (emoji: Emoji) => void

    stickySearch?: boolean // Deprecated
  }
}

declare module "@emoji-mart/react" {
  import type { FC } from "react"

  const Picker: FC<PickerProps>
  export default Picker
}

declare module "@emoji-mart/data" {
  interface Data {
    categories: Category[]
    emojis: { [key: string]: DataEmoji }
    aliases: { [key: string]: string }
    sheet: Sheet
  }

  interface Category {
    id: string
    emojis: string[]
  }

  interface DataEmoji {
    id: string
    name: string
    keywords: string[]
    skins: Skin[]
    version: number
    emoticons?: string[]
  }

  interface Skin {
    unified: string
    native: string
    x?: number
    y?: number
  }

  interface Sheet {
    cols: number
    rows: number
  }

  const data: Data
  export default data
}
