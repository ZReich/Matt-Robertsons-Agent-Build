import type { Metadata } from "next";

import { BasicEmojiPicker } from "./_components/basic-emoji-picker";
import { EmojiPickerSizes } from "./_components/emoji-picker-sizes";
import { EmojiPickerLocale } from "./_components/emoji-picker-locale";
import { EmojiPickerTheme } from "./_components/emoji-picker-theme";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Emoji Picker",
};

export default function EmojiPickerPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <BasicEmojiPicker />
      <EmojiPickerSizes />
      <EmojiPickerLocale />
      <EmojiPickerTheme />
    </section>
  );
}
