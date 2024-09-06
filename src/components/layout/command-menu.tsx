"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Sun, MoonStar, Laptop, File, Circle } from "lucide-react";
import { useTheme } from "next-themes";

import { docsConfig } from "@/configs/docs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Keyboard } from "@/components/ui/keyboard";
import { groupNavs } from "@/data/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CommandMenu({ ...props }: DialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "relative h-8 w-full justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        )}
        onClick={() => setOpen(true)}
        {...props}
      >
        <span className="hidden lg:inline-flex">Search documentation...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <Keyboard className="hidden absolute right-[0.3rem] top-[0.4.5rem] sm:flex">
          K
        </Keyboard>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search..." />
        <CommandList className="overflow-hidden">
          <ScrollArea className="h-[300px] max-h-[300px] px-1">
            <CommandEmpty>No results found.</CommandEmpty>
            {groupNavs.map((groupNav) => (
              <CommandGroup key={groupNav.title} heading={groupNav.title}>
                {groupNav.navs.map((navItem) => {
                  if (navItem.children) {
                    return navItem.children.map((nestedNavItem) => (
                      <CommandItem
                        key={nestedNavItem.href}
                        value={nestedNavItem.title}
                        onSelect={() => {
                          runCommand(() =>
                            router.push(nestedNavItem.href as string)
                          );
                        }}
                        className="cursor-pointer"
                      >
                        <navItem.icon className="me-2 size-4" />
                        {navItem.title + " - " + nestedNavItem.title}
                      </CommandItem>
                    ));
                  } else {
                    return (
                      <CommandItem
                        key={navItem.href}
                        value={navItem.title}
                        onSelect={() => {
                          runCommand(() => router.push(navItem.href as string));
                        }}
                        className="cursor-pointer"
                      >
                        <navItem.icon className="me-2 size-4" />
                        {navItem.title}
                      </CommandItem>
                    );
                  }
                })}
              </CommandGroup>
            ))}
          </ScrollArea>
        </CommandList>
      </CommandDialog>
    </>
  );
}
