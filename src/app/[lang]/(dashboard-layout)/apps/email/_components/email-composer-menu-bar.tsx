"use client";

import * as React from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  AlignRight,
  ImageIcon,
  LinkIcon,
  Palette,
  Type,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export interface HeadingType {
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  textSize: string;
}

export const headings: HeadingType[] = [
  { label: "Heading 1", level: 1, textSize: "text-3xl" },
  { label: "Heading 2", level: 2, textSize: "text-2xl" },
  { label: "Heading 3", level: 3, textSize: "text-xl" },
  { label: "Heading 4", level: 4, textSize: "text-lg" },
  { label: "Heading 5", level: 5, textSize: "text-base" },
  { label: "Heading 6", level: 6, textSize: "text-sm" },
];

interface EmailComposerMenuBarProps {
  editor: Editor | null;
}
export function EmailComposerMenuBar({ editor }: EmailComposerMenuBarProps) {
  // Return null if the editor hasn't initialized yet
  if (!editor) {
    return null;
  }

  return (
    <div
      className="border-b p-1.5 flex items-center gap-1.5 flex-wrap"
      aria-label="Rich-Text Editor Menu Bar"
    >
      {/* Dropdown for selecting paragraph and heading styles */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Select text style"
          >
            <Type className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {/* Paragraph and heading items */}
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={cn(
              "text-sm text-semibold",
              editor.isActive("paragraph") && "bg-muted"
            )}
          >
            Paragraph
          </DropdownMenuItem>
          {headings.map((heading: HeadingType) => (
            <DropdownMenuItem
              key={heading.level}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: heading.level })
                  .run()
              }
              className={cn(
                "font-semibold",
                heading.textSize,
                editor.isActive({ level: heading.level }) && "bg-muted"
              )}
            >
              {heading.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Color picker */}
      <ColorPicker editor={editor} />

      {/* Separator */}
      <Separator orientation="vertical" className="h-4" />

      {/* Formatting toggles */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Toggle bold"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Toggle italic"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("underline")}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Toggle underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Toggle strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      {/* Alignment toggles */}
      <Separator orientation="vertical" className="h-4" />
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: "left" })}
        onPressedChange={() =>
          editor.chain().focus().setTextAlign("left").run()
        }
        aria-label="Align left"
      >
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      {/* Additional alignment toggles for center, justify, and right */}

      {/* Image insertion button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().setImage({ src: "" }).run()}
        aria-label="Insert image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>

      {/* Link insertion button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          const url = "";
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        aria-label="Insert link"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ColorPicker({ editor }: { editor: Editor }) {
  const selectedColor = editor.getAttributes("textStyle").color;
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative overflow-hidden"
      onClick={() => inputRef.current?.click()}
      aria-label="Select text color"
    >
      <Palette style={{ color: selectedColor }} className="size-4" />
      <Input
        ref={inputRef}
        type="color"
        value={selectedColor}
        onChange={(e) =>
          editor
            .chain()
            .focus()
            .setColor(e.target.value as string)
            .run()
        }
        className="sr-only"
        tabIndex={-1}
      />
    </Button>
  );
}
