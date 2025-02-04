"use client";

import { CommandMenu } from "@/components/layout/command-menu";
import { TopBarHeaderMenubar } from "./top-bar-header-menubar";

import type { DictionaryType } from "@/lib/getDictionary";

export function TopBarHeader({ dictionary }: { dictionary: DictionaryType }) {
  return (
    <div className="container hidden justify-between items-center py-1 lg:flex">
      <TopBarHeaderMenubar dictionary={dictionary} />
      <CommandMenu />
    </div>
  );
}
