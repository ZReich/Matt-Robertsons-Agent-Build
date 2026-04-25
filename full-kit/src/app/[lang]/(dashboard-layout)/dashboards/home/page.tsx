import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowRight,
  Building2,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
} from "lucide-react"

import type { Metadata } from "next"
import type { ReactNode } from "react"

import { getDashboardData } from "@/lib/dashboard/queries"
import { DEAL_STAGE_LABELS } from "@/lib/vault"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AIApprovalBanner } from "./_components/ai-approval-banner"
import { MissedFollowupsWidget } from "./_components/missed-followups-widget"
import { NewLeadsWidget } from "./_components/new-leads-widget"
import { RevalidateOnFocus } from "./_components/revalidate-on-focus"
import { TodosWidget } from "./_components/todos-widget"

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

interface HomePageProps {
  params: Promise<{ lang: string }>
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString()}`
}

export default async function HomePage({ params }: HomePageProps) {
  const { lang } = await params
  const now = new Date()
  const data = await getDashboardData(now)
  const { pipeline } = data

  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const dueTodayCount = data.todayTodos.length + data.todayMeetings.length

  return (
    <section className="container max-w-screen-xl grid gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{greeting}, Matt.</h1>
        <p className="mt-1 text-muted-foreground">
          {format(now, "EEEE, MMMM d")} &middot; {pipeline.activeDeals.length}{" "}
          active deal{pipeline.activeDeals.length !== 1 ? "s" : ""}
          {dueTodayCount > 0 &&
            ` • ${dueTodayCount} item${dueTodayCount !== 1 ? "s" : ""} due today`}
        </p>
      </div>

      <AIApprovalBanner
        count={data.proposedTodos.length}
        titles={data.proposedTodos.slice(0, 3).map((todo) => todo.meta.title)}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Building2 className="size-3.5" /> Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">
                {pipeline.activeDeals.length}
              </span>
              <span className="text-sm text-muted-foreground">
                active deals
              </span>
            </div>
            {pipeline.totalValue > 0 && (
              <p className="text-lg font-semibold text-primary">
                {formatValue(pipeline.totalValue)} pipeline
              </p>
            )}
            <div className="space-y-1.5 pt-1">
              {Object.entries(pipeline.stageCounts).map(([stage, count]) => (
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
            {pipeline.closingThisMonth.length > 0 && (
              <Badge className="border-0 bg-emerald-100 text-xs text-emerald-700">
                {pipeline.closingThisMonth.length} closing this month
              </Badge>
            )}
          </CardContent>
          <div className="px-6 pb-4">
            <Link
              href={`/${lang}/pages/deals?view=kanban`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open Pipeline <ArrowRight className="size-3" />
            </Link>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Calendar className="size-3.5" /> Today&apos;s Agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {data.todayMeetings.length === 0 && data.todayTodos.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nothing scheduled for today.
              </p>
            ) : (
              <div className="space-y-3">
                {data.todayMeetings.map((meeting) => (
                  <div key={meeting.path} className="flex items-start gap-2">
                    <Calendar className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {meeting.meta.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(meeting.meta.date), "h:mm a")}
                        {meeting.meta.location && ` • ${meeting.meta.location}`}
                      </p>
                    </div>
                  </div>
                ))}
                {data.todayTodos.map((todo) => (
                  <div key={todo.path} className="flex items-start gap-2">
                    <div className="mt-0.5 size-3.5 shrink-0 rounded-full border-2 border-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {todo.meta.title}
                      </p>
                      {todo.meta.priority && (
                        <p className="text-xs capitalize text-muted-foreground">
                          {todo.meta.priority}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <TodosWidget
          proposedTodos={data.proposedTodos}
          urgentTodos={data.urgentTodos}
          contexts={data.todoContexts}
          lang={lang}
        />

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {data.recentComms.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No recent communications logged.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentComms.map((communication) => (
                  <div
                    key={communication.id}
                    className="flex items-start gap-2"
                  >
                    <span className="mt-0.5 shrink-0">
                      {CHANNEL_ICONS[communication.channel] ?? (
                        <MessageSquare className="size-3.5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {communication.contact?.name ?? "Unknown contact"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {communication.subject ?? "No subject"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(communication.date, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <div className="px-6 pb-4">
            <Link
              href={`/${lang}/apps/communications`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              All Activity <ArrowRight className="size-3" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <NewLeadsWidget data={data.newLeads} lang={lang} />
        <MissedFollowupsWidget
          followups={data.missedFollowups.top}
          total={data.missedFollowups.total}
          lang={lang}
          className="xl:col-span-2"
        />
      </div>

      <RevalidateOnFocus />
    </section>
  )
}
