"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface DocLinkProps {
  url: string
}

/** Returns true if the value looks like a local filesystem path rather than a URL */
function isLocalPath(value: string): boolean {
  return (
    /^[a-zA-Z]:[/\\]/.test(value) || // Windows: C:\ or C:/
    value.startsWith("/") || // Unix absolute
    value.startsWith("~/") || // Unix home-relative
    value.startsWith("\\\\") // Windows UNC share
  )
}

export function DocLink({ url }: DocLinkProps) {
  const [copied, setCopied] = useState(false)

  if (!url) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Pending
      </Badge>
    )
  }

  if (isLocalPath(url)) {
    function handleCopy() {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }

    return (
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
        title={url}
      >
        {copied ? (
          <>
            <Check className="size-3 text-green-500" />
            <span className="text-green-600">Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3" /> Copy Path
          </>
        )}
      </button>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
    >
      <ExternalLink className="size-3" /> Open
    </a>
  )
}
