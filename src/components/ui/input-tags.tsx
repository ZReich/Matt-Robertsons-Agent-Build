"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "./scroll-area";

export interface InputTagsProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export function InputTags({
  placeholder,
  tags,
  onTagsChange,
  className,
  ...props
}: InputTagsProps) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag]);
    }
    setInputValue("");
  };

  const removeTag = (indexToRemove: number) => {
    onTagsChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className={cn(
        "min-h-9 w-full flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center rounded-full bg-secondary px-3 py-0.5 text-sm font-medium text-secondary-foreground"
        >
          {tag}
          <Button
            variant="ghost"
            onClick={(e) => {
              e.preventDefault();
              removeTag(index);
            }}
            className="size-auto p-0.5 ms-0.5 -me-1 rounded-full hover:bg-secondary-foreground/20"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={tags.length === 0 ? placeholder : ""}
        {...props}
      />
    </div>
  );
}

interface InputTagsWithSuggestionsProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  tags: string[];
  suggestions: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export function InputTagsWithSuggestions({
  placeholder,
  tags,
  suggestions,
  onTagsChange,
  className,
  ...props
}: InputTagsWithSuggestionsProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(
    undefined
  );

  React.useEffect(() => {
    if (containerRef.current) {
      setPopoverWidth(containerRef.current.offsetWidth);
    }
  }, [open]);

  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion)
  );

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag]);
    }
    setInputValue("");
  };

  const removeTag = (indexToRemove: number) => {
    onTagsChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !open) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={containerRef}
          className={cn(
            "min-h-9 w-full flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            className
          )}
        >
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-full bg-secondary px-3 py-0.5 text-sm font-medium text-secondary-foreground"
            >
              {tag}
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  removeTag(index);
                }}
                className="size-auto p-0.5 ms-0.5 -me-1 rounded-full hover:bg-secondary-foreground/20"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder={tags.length === 0 ? placeholder : ""}
            {...props}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        style={{ width: popoverWidth ? `${popoverWidth}px` : "auto" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="flex flex-col max-h-[300px]">
          <Command>
            <CommandList className="max-h-full">
              <CommandEmpty>No results found.</CommandEmpty>
              {filteredSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  onSelect={() => addTag(suggestion)}
                >
                  {suggestion}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
