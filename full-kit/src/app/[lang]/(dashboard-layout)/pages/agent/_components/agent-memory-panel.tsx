"use client"

import { useState, useMemo } from "react"
import { BookOpen, Brain, FileText, Users, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import type { VaultNote, AgentMemoryMeta } from "@/lib/vault"

interface Props {
  memory: VaultNote<AgentMemoryMeta>[]
}

const MEMORY_TYPE_CONFIG: Record<
  string,
  { icon: typeof Brain; label: string; color: string }
> = {
  rule: {
    icon: FileText,
    label: "Rules",
    color: "text-red-600",
  },
  preference: {
    icon: Sparkles,
    label: "Preferences",
    color: "text-blue-600",
  },
  playbook: {
    icon: BookOpen,
    label: "Playbooks",
    color: "text-emerald-600",
  },
  "client-note": {
    icon: Users,
    label: "Client Notes",
    color: "text-violet-600",
  },
  "style-guide": {
    icon: Brain,
    label: "Style Guide",
    color: "text-amber-600",
  },
}

export function AgentMemoryPanel({ memory }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    memory[0]?.path ?? null
  )

  const selectedNote = useMemo(
    () => memory.find((m) => m.path === selectedPath) ?? null,
    [memory, selectedPath]
  )

  // Group by memory_type
  const grouped = useMemo(() => {
    const groups: Record<string, VaultNote<AgentMemoryMeta>[]> = {}
    for (const note of memory) {
      const type = note.meta.memory_type
      if (!groups[type]) groups[type] = []
      groups[type].push(note)
    }
    return groups
  }, [memory])

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Agent Memory</CardTitle>
          <CardDescription className="text-xs">
            {memory.length} file{memory.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <Separator />
        <ScrollArea className="h-[500px]">
          <div className="p-2">
            {Object.entries(grouped).map(([type, notes]) => {
              const config =
                MEMORY_TYPE_CONFIG[type] ?? MEMORY_TYPE_CONFIG.preference

              return (
                <div key={type} className="mb-3">
                  <div className="mb-1 flex items-center gap-1.5 px-2">
                    <config.icon
                      className={`h-3.5 w-3.5 ${config.color}`}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {config.label}
                    </span>
                  </div>
                  {notes.map((note) => (
                    <button
                      key={note.path}
                      onClick={() => setSelectedPath(note.path)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                        selectedPath === note.path
                          ? "bg-accent font-medium"
                          : ""
                      }`}
                    >
                      {note.meta.title}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Content */}
      <Card>
        {selectedNote ? (
          <>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedNote.meta.title}</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Last updated: {selectedNote.meta.last_updated ?? "Unknown"}{" "}
                    &middot; Priority: {selectedNote.meta.priority ?? "medium"}
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {MEMORY_TYPE_CONFIG[selectedNote.meta.memory_type]?.label ??
                    selectedNote.meta.memory_type}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <ScrollArea className="h-[460px]">
                <MarkdownRenderer content={selectedNote.content} size="compact" />
              </ScrollArea>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex flex-col items-center justify-center py-24">
            <Brain className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">No memory files</p>
            <p className="text-sm text-muted-foreground">
              Agent memory files will appear here once created.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
