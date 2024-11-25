"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { MoonStar, Sun } from "lucide-react";

import { i18n } from "@/configs/i18n";

import type { Locale } from "@/configs/i18n";

import type { Dictionary } from "@/lib/getDictionary";

import type { Mode } from "@/types";

import { useSettings } from "@/hooks/use-settings";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeDropdown({ dictionary }: { dictionary: Dictionary }) {
  const { settings, updateSettings } = useSettings();
  const params = useParams();

  const locale = params.lang as Locale;
  const direction = i18n.langDirection[locale];
  const mode = settings.mode;

  const setMode = React.useCallback(
    (modeName: Mode) => {
      updateSettings({ ...settings, mode: modeName });
    },
    [settings, updateSettings]
  );

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun
            className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            aria-hidden
          />
          <MoonStar
            className="absolute size-4 stroke-[1.5] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            aria-hidden
          />
          <span className="sr-only">
            {dictionary.navigation.mode["select-mode"]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          {dictionary.navigation.mode["mode"]}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={mode}>
          <DropdownMenuRadioItem
            value="light"
            className="hover:cursor-pointer"
            onClick={() => setMode("light")}
          >
            {dictionary.navigation.mode.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="hover:cursor-pointer"
            onClick={() => setMode("dark")}
          >
            {dictionary.navigation.mode.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="hover:cursor-pointer"
            onClick={() => setMode("system")}
          >
            {dictionary.navigation.mode.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
