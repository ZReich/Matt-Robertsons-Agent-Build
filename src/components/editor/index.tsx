"use client";

import * as React from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useDirection } from "@radix-ui/react-direction";

import { cn } from "@/lib/utils";

import type { UseEditorOptions } from "@tiptap/react";

import { useIsRtl } from "@/hooks/use-is-rtl";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorMenuBar } from "./editor-menu-bar";

interface EditorProps extends UseEditorOptions {
  value?: string;
  onValueChange?: (value: string) => void;
  bubbleMenu?: boolean;
  placeholder?: string;
  className?: string;
}

export function Editor({
  value,
  onValueChange,
  bubbleMenu = false,
  placeholder,
  className,
  ...props
}: EditorProps) {
  const direction = useDirection();
  const isRtl = useIsRtl();

  const editor = useEditor({
    editorProps: {
      attributes: {
        class: cn(
          "px-3 py-2 break-all [&_p]:m-0 [&_.is-editor-empty]:before:absolute [&_.is-editor-empty]:before:top-2 [&_.is-editor-empty]:before:cursor-text [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:content-[attr(data-placeholder)] prose prose-headings:font-normal prose-headings:text-foreground prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg dark:prose-invert focus:outline-none",
          className
        ),
      },
    },
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: isRtl ? "right" : "left",
      }),
      Color,
      TextStyle,
      Heading.configure({}),
      Image,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
        showOnlyCurrent: true,
      }),
      Typography,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onValueChange?.(editor.getHTML());
    },
    ...props,
  });

  if (!editor) {
    return null;
  }

  return (
    <Card>
      {bubbleMenu ? (
        <BubbleMenu
          className="z-50 h-auto rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
          editor={editor}
          tippyOptions={{
            duration: 100,
            maxWidth: "none",
            appendTo: document.body,
            zIndex: 50,
          }}
        >
          <EditorMenuBar editor={editor} />
        </BubbleMenu>
      ) : (
        <EditorMenuBar editor={editor} />
      )}
      <ScrollArea
        className={cn(
          "flex flex-col min-h-9 rounded-md cursor-text",
          !bubbleMenu && "border-t border-border",
          editor.isFocused && "outline-none ring-1 ring-ring"
        )}
      >
        <EditorContent
          editor={editor}
          dir={direction}
          className={cn(
            editor.isActive({ textAlign: "left" }) &&
              "[&_.is-editor-empty]:before:left-3",
            editor.isActive({ textAlign: "right" }) &&
              "[&_.is-editor-empty]:before:right-3",
            editor.isActive({ textAlign: "center" }) &&
              "[&_.is-editor-empty]:before:left-1/2 [&_.is-editor-empty]:before:absolute [&_.is-editor-empty]:before:-translate-x-1/2",
            editor.isActive({ textAlign: "justify" }) &&
              "[&_.is-editor-empty]:before:left-3"
          )}
          onClick={() => editor.commands.focus()}
        />
      </ScrollArea>
    </Card>
  );
}
