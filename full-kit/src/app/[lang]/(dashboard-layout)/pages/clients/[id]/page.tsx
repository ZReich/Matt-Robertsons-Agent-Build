import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import {
  Building2,
  Calendar,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
  Tag,
} from "lucide-react"
import { format } from "date-fns"

import { listNotes, normalizeEntityRef } from "@/lib/vault"
import type {
  ClientMeta,
  CommunicationMeta,
  DealMeta,
  MeetingMeta,
  TodoMeta,
} from "@/lib/vault"
import { DEAL_STAGE_LABELS } from "@/lib/vault"

import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { matchTranscriptsToMeetings } from "@/lib/transcript-matching"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ClientDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export async function generateMetadata({
  params,
}: ClientDetailPageProps): Promise<Metadata> {
  const { id } = await params
  return { title: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: "bg-slate-100 text-slate-700",
  listing: "bg-blue-100 text-blue-700",
  marketing: "bg-indigo-100 text-indigo-700",
  showings: "bg-violet-100 text-violet-700",
  offer: "bg-amber-100 text-amber-700",
  "under-contract": "bg-orange-100 text-orange-700",
  "due-diligence": "bg-yellow-100 text-yellow-700",
  closing: "bg-emerald-100 text-emerald-700",
  closed: "bg-green-100 text-green-700",
}

const CHANNEL_ICONS: Record<string, ReactNode> = {
  email: <Mail className="size-4 text-blue-500" />,
  call: <Phone className="size-4 text-green-500" />,
  text: <MessageSquare className="size-4 text-violet-500" />,
  whatsapp: <Smartphone className="size-4 text-teal-500" />,
  meeting: <Calendar className="size-4 text-amber-500" />,
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { id } = await params

  const [clientNotes, dealNotes, todoNotes, commNotes, meetingNotes] =
    await Promise.all([
      listNotes<ClientMeta>("clients"),
      listNotes<DealMeta>("clients"),
      listNotes<TodoMeta>("todos"),
      listNotes<CommunicationMeta>("communications"),
      listNotes<MeetingMeta>("meetings"),
    ])

  const clientNote = clientNotes.find(
    (n) => n.meta.type === "client" && n.path.split("/")[1] === id
  )

  if (!clientNote) notFound()

  const client = clientNote.meta

  const clientDeals = dealNotes.filter(
    (d) =>
      d.meta.type === "deal" &&
      normalizeEntityRef(d.meta.client ?? "") === client.name
  )

  const dealAddresses = new Set(
    clientDeals.map((d) => d.meta.property_address).filter(Boolean)
  )

  const matchesClient = (contact?: string, deal?: string) =>
    normalizeEntityRef(contact ?? "") === client.name ||
    (deal && dealAddresses.has(normalizeEntityRef(deal)))

  const clientTodos = todoNotes.filter((t) =>
    matchesClient(t.meta.contact, t.meta.deal)
  )

  const clientComms = commNotes
    .filter((c) => matchesClient(c.meta.contact, c.meta.deal))
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  const clientMeetings = meetingNotes
    .filter((m) => matchesClient(m.meta.contact, m.meta.deal))
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  // Auto-match Plaud call transcripts to meetings
  const transcriptMatches = matchTranscriptsToMeetings(clientComms, clientMeetings)

  const totalActivity =
    clientComms.length + clientMeetings.length + clientTodos.length

  const activeDeals = clientDeals.filter((d) => d.meta.stage !== "closed")
  const closedDeals = clientDeals.filter((d) => d.meta.stage === "closed")

  return (
    <section className="container max-w-5xl grid gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="size-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {client.company && (
            <p className="text-muted-foreground">{client.company}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {client.role && <Badge variant="secondary">{client.role}</Badge>}
            <Badge
              variant="outline"
              className={activeDeals.length > 0 ? "text-green-700" : ""}
            >
              {activeDeals.length} active deal
              {activeDeals.length !== 1 ? "s" : ""}
            </Badge>
            {clientComms.length > 0 && (
              <Badge variant="outline">
                {clientComms.length} comm{clientComms.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground text-right shrink-0">
          {client.updated && (
            <p>Updated {format(new Date(client.updated), "MMM d, yyyy")}</p>
          )}
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deals">
            Deals ({clientDeals.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({totalActivity})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${client.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.preferred_contact && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Prefers</span>
                  <span className="capitalize">{client.preferred_contact}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deal Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active</span>
                <span className="font-semibold">{activeDeals.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Closed</span>
                <span className="font-semibold">{closedDeals.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-semibold">
                  {clientDeals.reduce((sum, d) => sum + (d.meta.value ?? 0), 0) >
                  0
                    ? `$${(clientDeals.reduce((sum, d) => sum + (d.meta.value ?? 0), 0) / 1_000_000).toFixed(1)}M`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Communications</span>
                <span className="font-semibold">{clientComms.length}</span>
              </div>
            </CardContent>
          </Card>

          {clientComms.length > 0 && (
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {clientComms.slice(0, 3).map((c) => {
                  const dealName = c.meta.deal ? normalizeEntityRef(c.meta.deal) : null
                  return (
                    <div
                      key={c.path}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="shrink-0">
                        {CHANNEL_ICONS[c.meta.channel] ?? (
                          <MessageSquare className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="flex-1 truncate">
                        {c.meta.subject ?? c.meta.channel}
                      </span>
                      {dealName && (
                        <Badge variant="outline" className="text-xs py-0 shrink-0">
                          {dealName}
                        </Badge>
                      )}
                      <span className="text-muted-foreground shrink-0">
                        {format(new Date(c.meta.date), "MMM d")}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {(client.tags ?? []).length > 0 && (
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="size-3.5" /> Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(client.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="outline" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {clientNote.content && (
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer content={clientNote.content} size="compact" />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals" className="mt-4 space-y-3">
          {clientDeals.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No deals found for this client.
            </p>
          ) : (
            clientDeals.map((deal) => (
              <Card key={deal.path}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {deal.meta.property_address}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize mt-0.5">
                        {deal.meta.property_type?.replace("-", " ")} ·{" "}
                        {deal.meta.square_feet?.toLocaleString()} sq ft
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        className={`text-xs ${STAGE_COLORS[deal.meta.stage] ?? "bg-gray-100 text-gray-700"} border-0`}
                      >
                        {DEAL_STAGE_LABELS[deal.meta.stage]}
                      </Badge>
                      {deal.meta.value && (
                        <span className="text-sm font-semibold">
                          ${(deal.meta.value / 1_000_000).toFixed(1)}M
                        </span>
                      )}
                    </div>
                  </div>
                  {deal.meta.closing_date && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Closing:{" "}
                      {format(
                        new Date(deal.meta.closing_date),
                        "MMM d, yyyy"
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Activity Tab — unified timeline of comms, meetings, and todos */}
        <TabsContent value="activity" className="mt-4">
          {totalActivity === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No activity recorded for this client yet.
            </p>
          ) : (
            <ActivityTimeline
              communications={clientComms}
              meetings={clientMeetings}
              todos={clientTodos}
              transcriptMatches={transcriptMatches}
            />
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {clientNote.content ? (
                <MarkdownRenderer content={clientNote.content} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No notes for this client yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
