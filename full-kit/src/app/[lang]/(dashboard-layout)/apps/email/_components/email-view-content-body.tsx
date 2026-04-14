"use client"

import type { EmailType } from "../types"

import { CardContent } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

export function EmailViewContentBody({ email }: { email: EmailType }) {
  return (
    <CardContent>
      <MarkdownRenderer content={email.content} />
    </CardContent>
  )
}
