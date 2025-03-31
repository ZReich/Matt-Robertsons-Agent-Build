"use client"

import { useLayoutEffect, useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { bundledLanguages } from "shiki/bundle/web"

import type { JSX } from "react"
import type { BundledLanguage } from "shiki/bundle/web"

import { Button } from "@/components/ui/button"
import { highlight } from "./highlight"

function isBundledLanguage(value: unknown): value is BundledLanguage {
  return typeof value === "string" && value in bundledLanguages
}

export function CodeBlock({
  children,
  lang,
}: {
  children: string
  lang: string
}) {
  const [nodes, setNodes] = useState<JSX.Element>()
  const [copied, setCopied] = useState(false)

  const language = isBundledLanguage(lang) ? lang : "markdown"

  useLayoutEffect(() => {
    void highlight(children, language).then(setNodes)
  }, [children, language])

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <CopyToClipboard text={children} onCopy={handleCopy}>
        <Button variant="secondary" className="absolute end-2 top-2 w-16">
          {copied ? "Copied!" : "Copy"}
        </Button>
      </CopyToClipboard>
      {nodes}
    </div>
  )
}
