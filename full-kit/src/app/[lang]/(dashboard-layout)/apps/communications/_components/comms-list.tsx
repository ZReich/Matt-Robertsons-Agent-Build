"use client"

import { useMemo, type ReactNode } from "react"
import { format, isToday, isYesterday } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Smartphone,
  X,
} from "lucide-react"

import type { CommunicationMeta, VaultNote } from "@/lib/vault/shared"
import { normalizeEntityRef } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type CommNote = VaultNote<CommunicationMeta>

interface CommsListProps {
  notes: CommNote[]
  selectedPath: string | null
  onSelect: (path: string) => void
  search: string
  onSearchChange: (value: string) => void
  channel: string
  onChannelChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
}

const CHANNEL_CONFIG: Record<
  string,
  { icon: ReactNode; label: string; color: string }
> = {
  email: {
    icon: <Mail className="size-3.5" />,
    label: "Email",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  call: {
    icon: <Phone className="size-3.5" />,
    label: "Call",
    color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  text: {
    icon: <MessageSquare className="size-3.5" />,
    label: "Text",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  whatsapp: {
    icon: <Smartphone className="size-3.5" />,
    label: "WhatsApp",
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  },
  meeting: {
    icon: <Calendar className="size-3.5" />,
    label: "Meeting",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
}

const CHANNELS = ["all", "email", "call", "text", "whatsapp", "meeting"]
const CATEGORIES = ["all", "business", "personal"]

function groupByDay(notes: CommNote[]): [string, CommNote[]][] {
  const groups = new Map<string, CommNote[]>()
  for (const note of notes) {
    const day = format(new Date(note.meta.date), "yyyy-MM-dd")
    const existing = groups.get(day) ?? []
    existing.push(note)
    groups.set(day, existing)
  }
  return Array.from(groups.entries())
}

function dayLabel(dayKey: string): string {
  const d = new Date(dayKey + "T12:00:00")
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMMM d, yyyy")
}

export function CommsList({
  notes,
  selectedPath,
  onSelect,
  search,
  onSearchChange,
  channel,
  onChannelChange,
  category,
  onCategoryChange,
}: CommsListProps) {
  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (channel !== "all" && n.meta.channel !== channel) return false
      if (category !== "all" && n.meta.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        const contactName = normalizeEntityRef(n.meta.contact).toLowerCase()
        const subject = (n.meta.subject ?? "").toLowerCase()
        if (!contactName.includes(q) && !subject.includes(q)) return false
      }
      return true
    })
  }, [notes, search, channel, category])

  const grouped = groupByDay(filtered)

  const channelLabel =
    channel === "all"
      ? "All Channels"
      : (CHANNEL_CONFIG[channel]?.label ?? channel)
  const categoryLabel =
    category === "all"
      ? "All"
      : category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <div className="flex h-full flex-col">
      {/* Search + Filters */}
      <div className="border-b p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts or subjects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                {channelLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {CHANNELS.map((c) => (
                <DropdownMenuItem key={c} onClick={() => onChannelChange(c)}>
                  {c === "all"
                    ? "All Channels"
                    : (CHANNEL_CONFIG[c]?.label ?? c)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                {categoryLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {CATEGORIES.map((c) => (
                <DropdownMenuItem key={c} onClick={() => onCategoryChange(c)}>
                  {c === "all"
                    ? "All"
                    : c.charAt(0).toUpperCase() + c.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No communications match your filters.
          </p>
        ) : (
          <div className="py-1">
            {grouped.map(([day, dayNotes]) => (
              <div key={day}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                  {dayLabel(day)}
                </p>
                {dayNotes.map((note) => {
                  const config = CHANNEL_CONFIG[note.meta.channel]
                  const contactName = normalizeEntityRef(note.meta.contact)
                  const isSelected = selectedPath === note.path
                  const isInbound = note.meta.direction !== "outbound"

                  return (
                    <button
                      key={note.path}
                      onClick={() => onSelect(note.path)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors border-l-2 ${
                        isSelected
                          ? "bg-accent border-l-primary"
                          : "border-l-transparent hover:bg-accent/50"
                      }`}
                    >
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                          config?.color ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {config?.icon ?? <MessageSquare className="size-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {contactName}
                          </span>
                          {note.meta.direction && (
                            <span className="shrink-0">
                              {isInbound ? (
                                <ArrowDownLeft className="size-3 text-green-600" />
                              ) : (
                                <ArrowUpRight className="size-3 text-blue-600" />
                              )}
                            </span>
                          )}
                        </div>
                        {note.meta.subject && (
                          <p className="text-xs text-muted-foreground truncate">
                            {note.meta.subject}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {format(new Date(note.meta.date), "h:mm a")}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
