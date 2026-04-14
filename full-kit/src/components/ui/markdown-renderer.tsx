"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

interface MarkdownRendererProps extends ComponentProps<"div"> {
  /** The raw markdown string to render */
  content: string
  /** Size variant — compact reduces spacing for inline use */
  size?: "default" | "compact" | "large"
}

/**
 * Renders markdown content as beautifully formatted HTML using Tailwind Typography.
 *
 * Supports:
 * - Headings, paragraphs, bold, italic, strikethrough
 * - Ordered & unordered lists
 * - Task lists (checkboxes) via GFM
 * - Tables with borders and alternating rows
 * - Block quotes with left accent border
 * - Inline code and fenced code blocks
 * - Links with primary color styling
 * - Horizontal rules
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  size = "default",
  className,
  ...props
}: MarkdownRendererProps) {
  if (!content?.trim()) {
    return (
      <p className="text-sm italic text-muted-foreground">No content</p>
    )
  }

  return (
    <div
      className={cn(
        // Base prose styling from @tailwindcss/typography
        "prose prose-neutral dark:prose-invert max-w-none",

        // Size variants
        size === "compact" && "prose-sm",
        size === "large" && "prose-lg",

        // Headings: match dashboard card styling
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h1:mb-4",
        "prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3",
        "prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2",

        // Paragraphs: comfortable reading
        "prose-p:leading-relaxed prose-p:text-foreground",

        // Links: use primary color
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",

        // Lists: clean spacing
        "prose-li:marker:text-muted-foreground",
        "prose-ul:my-2 prose-ol:my-2",

        // Blockquotes: accent border
        "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-md prose-blockquote:py-1 prose-blockquote:not-italic",

        // Code: match shadcn code styling
        "prose-code:bg-muted prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",

        // Code blocks
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg",

        // Tables: clean with borders
        "prose-table:border prose-table:border-border prose-table:rounded-lg",
        "prose-th:bg-muted prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:tracking-wider",
        "prose-td:border-border prose-td:px-3 prose-td:py-2",

        // HRs: subtle
        "prose-hr:border-border",

        // Strong/bold: slightly heavier
        "prose-strong:text-foreground",

        className
      )}
      {...props}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom checkbox rendering for task lists
          input: ({ node, ...inputProps }) => {
            if (inputProps.type === "checkbox") {
              return (
                <Checkbox
                  checked={inputProps.checked}
                  disabled
                  className="mr-2 align-middle translate-y-[-1px]"
                />
              )
            }
            return <input {...inputProps} />
          },

          // Open links in new tab
          a: ({ node, ...anchorProps }) => (
            <a {...anchorProps} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
