"use client"

import { useState } from "react"
import { Check, Copy, Mail, Search, X } from "lucide-react"

import type { TemplateMeta, VaultNote } from "@/lib/vault/shared"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

type TemplateNote = VaultNote<TemplateMeta>

interface TemplateViewerProps {
  templates: TemplateNote[]
}

/** Replace {{variable}} with styled spans */
function highlightVariables(text: string): ReactNode[] {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return parts.map((part, i) => {
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return (
        <span
          key={i}
          className="inline-block px-1 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20"
        >
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function TemplateViewer({ templates }: TemplateViewerProps) {
  const [selected, setSelected] = useState<TemplateNote | null>(
    templates[0] ?? null
  )
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState(false)

  const filtered = templates.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.meta.name.toLowerCase().includes(q) ||
      (t.meta.use_case ?? "").toLowerCase().includes(q)
    )
  })

  function copy() {
    if (!selected) return
    const text = [
      selected.meta.subject ? `Subject: ${selected.meta.subject}\n\n` : "",
      selected.content,
    ].join("")
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col md:flex-row gap-0 rounded-lg border bg-card overflow-hidden min-h-[500px]">
      {/* Left panel — template list */}
      <div className="md:w-64 border-b md:border-b-0 md:border-r flex flex-col shrink-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">
                No templates found.
              </p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.path}
                  onClick={() => setSelected(t)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                    selected?.path === t.path
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <p className="font-medium leading-tight truncate">
                    {t.meta.name}
                  </p>
                  {t.meta.use_case && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {t.meta.use_case}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel — preview */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">
              Select a template to preview.
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <h2 className="font-semibold">{selected.meta.name}</h2>
                </div>
                {selected.meta.use_case && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selected.meta.use_case}
                  </p>
                )}
                {selected.meta.tags && selected.meta.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selected.meta.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs capitalize py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={copy}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 mr-1.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 mr-1.5" /> Copy
                  </>
                )}
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {selected.meta.subject && (
                  <div className="p-3 rounded-md bg-muted/50 border">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      SUBJECT
                    </p>
                    <p className="text-sm font-medium">
                      {highlightVariables(selected.meta.subject)}
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    BODY
                  </p>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                    {highlightVariables(selected.content)}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  )
}
