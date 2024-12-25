"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMedia } from "react-use";
import { Search } from "lucide-react";

import { navigationsData } from "@/data/navigations";

import { cn } from "@/lib/utils";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicIcon } from "@/components/dynamic-icon";

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
            {navigationsData.map((nav) => (
              <CommandGroup key={nav.title} heading={nav.title}>
                {nav.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.title}
                    onSelect={() => {
                      runCommand(() => router.push(item.href));
                    }}
                    className="cursor-pointer"
                  >
                    <DynamicIcon name={item.iconName} className="me-2 size-4" />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </ScrollArea>
        </CommandList>
      </CommandDialog>
    </>
  );
}
