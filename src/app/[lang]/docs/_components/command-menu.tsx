"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMedia } from "react-use";
import { Search } from "lucide-react";

import type { ButtonProps } from "@/components/ui/button";

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
import { groupNavs } from "@/data/navigations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicIcon } from "@/components/dynamic-icon";
import { cn } from "@/lib/utils";

interface CommandMenuProps extends ButtonProps {
  className?: string;
}
export function CommandMenu({ className, ...props }: CommandMenuProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const isLargeOrLarger = useMedia("(min-width: 1024px)");

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
      {isLargeOrLarger ? (
        <Button
          variant="outline"
          className={cn(
            "relative h-8 w-full justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pe-12 md:w-40 lg:w-64",
            className
          )}
          onClick={() => setOpen(true)}
          {...props}
        >
          <span className="inline-flex">Search...</span>
          <Keyboard className="hidden absolute end-[0.3rem] top-[0.4.5rem] sm:flex">
            K
          </Keyboard>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onClick={() => setOpen(true)}
          aria-label="Search"
          {...props}
        >
          <Search className="h-4 w-4" />
        </Button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search..." />
        <CommandList className="overflow-hidden">
          <ScrollArea className="h-[300px] max-h-[300px]">
            <CommandEmpty>No results found.</CommandEmpty>
            {groupNavs.map((groupNav) => (
              <CommandGroup key={groupNav.name} heading={groupNav.name}>
                {groupNav.navs.map((navItem) => {
                  if (navItem.children) {
                    return navItem.children.map((nestedNavItem) => (
                      <CommandItem
                        key={nestedNavItem.href}
                        value={nestedNavItem.name}
                        onSelect={() => {
                          runCommand(() =>
                            router.push(nestedNavItem.href as string)
                          );
                        }}
                        className="cursor-pointer"
                      >
                        <DynamicIcon
                          name={navItem.iconName}
                          className="me-2 size-4"
                        />
                        {navItem.name + " - " + nestedNavItem.name}
                      </CommandItem>
                    ));
                  } else {
                    return (
                      <CommandItem
                        key={navItem.href}
                        value={navItem.name}
                        onSelect={() => {
                          runCommand(() => router.push(navItem.href as string));
                        }}
                        className="cursor-pointer"
                      >
                        <DynamicIcon
                          name={navItem.iconName}
                          className="me-2 size-4"
                        />
                        {navItem.name}
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
