"use client";

import { useParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
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

import { cn } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailComposerMenuBar } from "./email-composer-menu-bar";

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function EmailComposer({ content, onChange }: TiptapEditorProps) {
  const params = useParams();

  const locale = params.lang as LocaleType;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: locale === "ar" ? "right" : "left",
      }),
      Color,
      TextStyle,
      Heading.configure({}),
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Write your message here...",
        emptyEditorClass: "is-editor-empty",
      }),
      Typography,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Return null if the editor hasn't initialized yet
  if (!editor) {
    return null;
  }

  return (
    <Card>
      <EmailComposerMenuBar editor={editor} />
      <ScrollArea className="h-[7.5rem]">
        <EditorContent
          editor={editor}
          className={cn(
            "max-w-none p-px prose prose-sm prose-img:rounded-md prose-p:leading-normal prose-headings:leading-normal dark:prose-invert",
            "[&_>_.ProseMirror_>_*]:m-0",
            "[&_>_.ProseMirror]:p-3 focus-visible:[&_>_.ProseMirror-focused]:outline-none focus-visible:[&_>_.ProseMirror-focused]:ring-1 focus-visible:[&_>_.ProseMirror-focused]:ring-ring",
            "[&_>_.ProseMirror_.is-editor-empty]:first:before:content-[attr(data-placeholder)] [&_>_.ProseMirror_.is-editor-empty]:first:before:text-muted-foreground [&_>_.ProseMirror_.is-editor-empty]:first:before:pointer-events-none [&_>_.ProseMirror_.is-editor-empty]:first:before:h-0 [&_>_.ProseMirror_.is-editor-empty]:first:before:px-3",
            "[&_>_.ProseMirror]:relative [&_>_.ProseMirror_.is-editor-empty]:first:before:absolute",
            editor.isActive({ textAlign: "left" }) &&
              "[&_>_.ProseMirror_.is-editor-empty]:first:before:left-0",
            editor.isActive({ textAlign: "right" }) &&
              "[&_>_.ProseMirror_.is-editor-empty]:first:before:right-0",
            editor.isActive({ textAlign: "center" }) &&
              "[&_>_.ProseMirror_.is-editor-empty]:first:before:left-1/2 [&_>_.ProseMirror_.is-editor-empty]:first:before:absolute [&_>_.ProseMirror_.is-editor-empty]:first:before:-translate-x-1/2",
            editor.isActive({ textAlign: "justify" }) &&
              "[&_>_.ProseMirror_.is-editor-empty]:first:before:left-0"
          )}
        />
      </ScrollArea>
    </Card>
  );
}
