"use client";

import type { DictionaryType } from "@/lib/getDictionary";

import { Separator } from "@/components/ui/separator";
import { TopBarHeader } from "./top-bar-header";
import { BottomBarHeader } from "./bottom-bar-header";

export function HorizontalLayoutHeader({
  dictionary,
}: {
  dictionary: DictionaryType;
}) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <TopBarHeader dictionary={dictionary} />
      <BottomBarHeader dictionary={dictionary} />
    </header>
  );
}
