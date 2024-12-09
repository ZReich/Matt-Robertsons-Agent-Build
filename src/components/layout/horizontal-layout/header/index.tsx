"use client";

import type { DictionaryType } from "@/lib/getDictionary";

import { Separator } from "@/components/ui/separator";
import { TopBarHeader } from "./top-bar-header";
import { BottomBarHeader } from "./bottom-bar-header";

export function Header({ dictionary }: { dictionary: DictionaryType }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <TopBarHeader />
      <Separator className="hidden bg-accent h-[0.5px] md:block" />
      <BottomBarHeader dictionary={dictionary} />
    </header>
  );
}
