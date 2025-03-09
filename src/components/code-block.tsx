"use client"

import React from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism"

import { Button } from "./ui/button"

export function CodeBlock({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const language = className ? className.replace(/language-/, "") : "text"

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  console.log(children)
  return (
    <div className="relative">
      <CopyToClipboard text={children} onCopy={handleCopy}>
        <Button variant="secondary" className="absolute end-2 top-2 w-16">
          {copied ? "Copied!" : "Copy"}
        </Button>
      </CopyToClipboard>
      <SyntaxHighlighter language={language} style={atomDark}>
        {children}
      </SyntaxHighlighter>
    </div>
  )
}
