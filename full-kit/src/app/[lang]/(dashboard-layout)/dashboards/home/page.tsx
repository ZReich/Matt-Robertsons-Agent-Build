import Link from "next/link"
import {
  format,
  formatDistanceToNow,
  isBefore,
  isToday,
  startOfDay,
} from "date-fns"
import {
  ArrowRight,
  Building2,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
} from "lucide-react"

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  MeetingMeta,
  TodoMeta,
} from "@/lib/vault"
import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DEAL_STAGE_LABELS, listNotes } from "@/lib/vault"
import { resolveAllTodoContexts } from "@/lib/vault/resolve-context"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UrgentTodosCard } from "./_components/urgent-todos-card"

export const metadata: Metadata = {
  title: "Home",
}

const CHANNEL_ICONS: Record<string, ReactNode> = {
  email: <Mail className="size-3.5 text-blue-500" />,
  call: <Phone className="size-3.5 text-green-500" />,
  text: <MessageSquare className="size-3.5 text-violet-500" />,
  whatsapp: <Smartphone className="size-3.5 text-teal-500" />,
  meeting: <Calendar className="size-3.5 text-amber-500" />,
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString()}`
}

export default async function HomePage() {
  const now = new Date()
  const todayStart = startOfDay(now)

  const [
    dealNotes,
    todoNotes,
    meetingNotes,
    commNotes,
    clientNotes,
    contactNotes,
  ] = await Promise.all([
    listNotes<DealMeta>("clients"),
    listNotes<TodoMeta>("todos"),
    listNotes<MeetingMeta>("meetings"),
    listNotes<CommunicationMeta>("communications"),
    listNotes<ClientMeta>("clients"),
    listNotes<ContactMeta>("contacts"),
  ])

  // Resolve context for todos used in urgent/today sections
  const todoContexts = resolveAllTodoContexts(
    todoNotes,
    clientNotes,
    contactNotes,
    dealNotes,
    commNotes
  )

  // --- Pipeline data ---
  const activeDeals = dealNotes.filter(
    (n) => n.meta.type === "deal" && n.meta.stage !== "closed"
  )
  const totalValue = activeDeals.reduce(
    (sum, d) => sum + (d.meta.value ?? 0),
    0
  )
  const stageCounts = activeDeals.reduce(
    (acc, d) => {
      acc[d.meta.stage] = (acc[d.meta.stage] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const closingThisMonth = activeDeals.filter((d) => {
    if (!d.meta.closing_date) return false
    const closing = new Date(d.meta.closing_date)
    return (
      closing.getMonth() === now.getMonth() &&
      closing.getFullYear() === now.getFullYear()
    )
  })

  // --- Today's Agenda ---
  const todayMeetings = meetingNotes.filter((m) =>
    isToday(new Date(m.meta.date))
  )
  const todayTodos = todoNotes
    .filter(
      (t) =>
        t.meta.due_date &&
        isToday(new Date(t.meta.due_date)) &&
        t.meta.status !== "done"
    )
    .sort(
      (a, b) =>
        new Date(a.meta.due_date!).getTime() -
        new Date(b.meta.due_date!).getTime()
    )

  // --- Urgent Todos ---
  const urgentTodos = todoNotes
    .filter(
      (t) =>
        t.meta.status !== "done" &&
        (t.meta.priority === "urgent" ||
          t.meta.priority === "high" ||
          (t.meta.due_date && isBefore(new Date(t.meta.due_date), todayStart)))
    )
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.meta.priority ?? "medium"] ?? 2) -
        (PRIORITY_ORDER[b.meta.priority ?? "medium"] ?? 2)
    )
    .slice(0, 6)

  // --- Recent Activity ---
  const recentComms = [...commNotes]
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )
    .slice(0, 5)

  // Greeting
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const dueTodayCount = todayTodos.length + todayMeetings.length

  return (
    <section className="container max-w-screen-xl grid gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{greeting}, Matt.</h1>
        <p className="text-muted-foreground mt-1">
          {format(now, "EEEE, MMMM d")} &middot; {activeDeals.length} active
          deal{activeDeals.length !== 1 ? "s" : ""}
          {dueTodayCount > 0 &&
            ` · ${dueTodayCount} item${dueTodayCount !== 1 ? "s" : ""} due today`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* ── 1. Pipeline Snapshot ── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5" /> Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-3xl font-bold">{activeDeals.length}</span>
              <span className="text-sm text-muted-foreground">
                active deals
              </span>
            </div>
            {totalValue > 0 && (
              <p className="text-lg font-semibold text-primary">
                {formatValue(totalValue)} pipeline
              </p>
            )}
            <div className="space-y-1.5 pt-1">
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div key={stage} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {DEAL_STAGE_LABELS[
                      stage as keyof typeof DEAL_STAGE_LABELS
                    ] ?? stage}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
            {closingThisMonth.length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                {closingThisMonth.length} closing this month
              </Badge>
            )}
          </CardContent>
          <div className="px-6 pb-4">
            <Link
              href="../apps/kanban"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Open Pipeline <ArrowRight className="size-3" />
            </Link>
          </div>
        </Card>

        {/* ── 2. Today's Agenda ── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Today&apos;s Agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {todayMeetings.length === 0 && todayTodos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nothing scheduled for today.
              </p>
            ) : (
              <div className="space-y-3">
                {todayMeetings.map((m) => (
                  <div key={m.path} className="flex items-start gap-2">
                    <Calendar className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {m.meta.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.meta.date), "h:mm a")}
                        {m.meta.location && ` · ${m.meta.location}`}
                      </p>
                    </div>
                  </div>
                ))}
                {todayTodos.map((t) => (
                  <div key={t.path} className="flex items-start gap-2">
                    <div className="size-3.5 rounded-full border-2 border-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {t.meta.title}
                      </p>
                      {t.meta.priority && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {t.meta.priority}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 3. Urgent Todos (client component with drawer) ── */}
        <UrgentTodosCard
          todos={urgentTodos}
          contexts={todoContexts}
          lang="en"
        />

        {/* ── 4. Recent Activity ── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {recentComms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No recent communications logged.
              </p>
            ) : (
              <div className="space-y-3">
                {recentComms.map((c) => {
                  const contactName = c.meta.contact.replace(/\[\[|\]\]/g, "")
                  return (
                    <div key={c.path} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">
                        {CHANNEL_ICONS[c.meta.channel] ?? (
                          <MessageSquare className="size-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">
                          {contactName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.meta.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.meta.date), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
          <div className="px-6 pb-4">
            <Link
              href="../apps/communications"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              All Activity <ArrowRight className="size-3" />
            </Link>
          </div>
        </Card>
      </div>
    </section>
  )
}
