"use client"

import { useState, useMemo, type ReactNode } from "react"
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

import type { CommunicationMeta, VaultNote } from "@/lib/vault"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type CommNote = VaultNote<CommunicationMeta>

interface CommsFeedProps {
  notes: CommNote[]
}

const CHANNEL_CONFIG: Record<
  string,
  { icon: ReactNode; label: string; color: string }
> = {
  email: {
    icon: <Mail className="size-4" />,
    label: "Email",
    color: "bg-blue-100 text-blue-700",
  },
  call: {
    icon: <Phone className="size-4" />,
    label: "Call",
    color: "bg-green-100 text-green-700",
  },
  text: {
    icon: <MessageSquare className="size-4" />,
    label: "Text",
    color: "bg-violet-100 text-violet-700",
  },
  whatsapp: {
    icon: <Smartphone className="size-4" />,
    label: "WhatsApp",
    color: "bg-teal-100 text-teal-700",
  },
  meeting: {
    icon: <Calendar className="size-4" />,
    label: "Meeting",
    color: "bg-amber-100 text-amber-700",
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

export function CommsFeed({ notes }: CommsFeedProps) {
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState("all")
  const [category, setCategory] = useState("all")

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (channel !== "all" && n.meta.channel !== channel) return false
      if (category !== "all" && n.meta.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        const contactName = n.meta.contact
          .replace(/\[\[|\]\]/g, "")
          .toLowerCase()
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
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by contact or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {channelLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {CHANNELS.map((c) => (
              <DropdownMenuItem key={c} onClick={() => setChannel(c)}>
                {c === "all" ? "All Channels" : (CHANNEL_CONFIG[c]?.label ?? c)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {categoryLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {CATEGORIES.map((c) => (
              <DropdownMenuItem key={c} onClick={() => setCategory(c)}>
                {c === "all"
                  ? "All"
                  : c.charAt(0).toUpperCase() + c.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Feed */}
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No communications match your filters.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayNotes]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {dayLabel(day)}
              </p>
              <div className="space-y-2">
                {dayNotes.map((note) => {
                  const config = CHANNEL_CONFIG[note.meta.channel]
                  const contactName = note.meta.contact.replace(
                    /\[\[|\]\]/g,
                    ""
                  )
                  const dealName = note.meta.deal?.replace(/\[\[|\]\]/g, "")
                  const isInbound = note.meta.direction !== "outbound"

                  return (
                    <div
                      key={note.path}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      {/* Channel icon */}
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config?.color ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {config?.icon ?? (
                          <MessageSquare className="size-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {contactName}
                          </span>
                          {note.meta.direction && (
                            <span
                              className={`flex items-center gap-0.5 text-xs ${isInbound ? "text-green-600" : "text-blue-600"}`}
                            >
                              {isInbound ? (
                                <ArrowDownLeft className="size-3" />
                              ) : (
                                <ArrowUpRight className="size-3" />
                              )}
                              {isInbound ? "Inbound" : "Outbound"}
                            </span>
                          )}
                          {dealName && (
                            <Badge variant="outline" className="text-xs py-0">
                              {dealName}
                            </Badge>
                          )}
                        </div>
                        {note.meta.subject && (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {note.meta.subject}
                          </p>
                        )}
                      </div>

                      {/* Time */}
                      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                        {format(new Date(note.meta.date), "h:mm a")}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
