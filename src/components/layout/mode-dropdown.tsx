"use client";

import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";

import { i18n } from "@/configs/i18n";

import type { Locale } from "@/configs/i18n";

import type { Dictionary } from "@/lib/getDictionary";

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
  const { setTheme, theme } = useTheme();
  const params = useParams();

  const locale = params.lang as Locale;
  const direction = i18n.langDirection[locale];

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <SunIcon
            className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            aria-hidden
          />
          <MoonIcon
            className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
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
        <DropdownMenuRadioGroup value={theme}>
          <DropdownMenuRadioItem
            value="light"
            className="hover:cursor-pointer"
            onClick={() => setTheme("light")}
          >
            {dictionary.navigation.mode.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="hover:cursor-pointer"
            onClick={() => setTheme("dark")}
          >
            {dictionary.navigation.mode.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="hover:cursor-pointer"
            onClick={() => setTheme("system")}
          >
            {dictionary.navigation.mode.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
