import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Smartphone,
  Tag,
} from "lucide-react"
import { format } from "date-fns"

import { listNotes } from "@/lib/vault"
import type {
  ClientMeta,
  CommunicationMeta,
  DealMeta,
  MeetingMeta,
  TodoMeta,
} from "@/lib/vault"
import { DEAL_STAGE_LABELS } from "@/lib/vault"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      d.meta.client?.replace(/\[\[|\]\]/g, "") === client.name
  )

  const dealAddresses = new Set(
    clientDeals.map((d) => d.meta.property_address).filter(Boolean)
  )

  // Fixed: strip [[...]] brackets when matching
  const clientTodos = todoNotes.filter(
    (t) =>
      t.meta.contact?.replace(/\[\[|\]\]/g, "") === client.name ||
      (t.meta.deal &&
        dealAddresses.has(t.meta.deal.replace(/\[\[|\]\]/g, "")))
  )

  // Communications for this client (by contact name or deal)
  const clientComms = commNotes
    .filter(
      (c) =>
        c.meta.contact?.replace(/\[\[|\]\]/g, "") === client.name ||
        (c.meta.deal && dealAddresses.has(c.meta.deal.replace(/\[\[|\]\]/g, "")))
    )
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  // Meetings for this client
  const now = new Date()
  const clientMeetings = meetingNotes
    .filter(
      (m) =>
        m.meta.contact === client.name ||
        (m.meta.deal && dealAddresses.has(m.meta.deal.replace(/\[\[|\]\]/g, "")))
    )
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

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
          <TabsTrigger value="comms">
            Communications ({clientComms.length})
          </TabsTrigger>
          <TabsTrigger value="meetings">
            Meetings ({clientMeetings.length})
          </TabsTrigger>
          <TabsTrigger value="todos">
            Todos ({clientTodos.length})
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
                  const dealName = c.meta.deal?.replace(/\[\[|\]\]/g, "")
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
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {clientNote.content}
                </p>
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

        {/* Communications Tab */}
        <TabsContent value="comms" className="mt-4 space-y-3">
          {clientComms.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No communications logged for this client yet.
            </p>
          ) : (
            clientComms.map((comm) => {
              const dealName = comm.meta.deal?.replace(/\[\[|\]\]/g, "")
              const isInbound = comm.meta.direction !== "outbound"
              return (
                <Card key={comm.path}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {CHANNEL_ICONS[comm.meta.channel] ?? (
                        <MessageSquare className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {comm.meta.subject ?? comm.meta.channel}
                        </span>
                        {comm.meta.direction && (
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
                          <Badge
                            variant="outline"
                            className="text-xs py-0"
                          >
                            {dealName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(comm.meta.date), "MMMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="mt-4 space-y-3">
          {clientMeetings.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No meetings recorded for this client.
            </p>
          ) : (
            clientMeetings.map((meeting) => {
              const isPast = new Date(meeting.meta.date) < now
              const dealName = meeting.meta.deal?.replace(/\[\[|\]\]/g, "")
              return (
                <Card key={meeting.path} className={isPast ? "opacity-75" : ""}>
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{meeting.meta.title}</p>
                        {dealName && (
                          <Badge variant="outline" className="text-xs py-0">
                            {dealName}
                          </Badge>
                        )}
                      </div>
                      {meeting.meta.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="size-3" />
                          {meeting.meta.location}
                        </div>
                      )}
                      {meeting.meta.duration_minutes && (
                        <p className="text-xs text-muted-foreground">
                          {meeting.meta.duration_minutes} min
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {format(new Date(meeting.meta.date), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(meeting.meta.date), "h:mm a")}
                      </p>
                      {isPast && (
                        <Badge
                          variant="outline"
                          className="text-xs mt-1 text-muted-foreground"
                        >
                          Past
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Todos Tab */}
        <TabsContent value="todos" className="mt-4 space-y-3">
          {clientTodos.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No todos linked to this client.
            </p>
          ) : (
            clientTodos.map((todo) => (
              <Card key={todo.path}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckSquare
                      className={`size-4 shrink-0 ${todo.meta.status === "done" ? "text-green-600" : "text-muted-foreground"}`}
                    />
                    <div>
                      <p
                        className={`text-sm font-medium ${todo.meta.status === "done" ? "line-through text-muted-foreground" : ""}`}
                      >
                        {todo.meta.title}
                      </p>
                      {todo.meta.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due{" "}
                          {format(new Date(todo.meta.due_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  {todo.meta.priority && (
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize shrink-0 ${
                        todo.meta.priority === "urgent"
                          ? "border-red-400 text-red-600"
                          : todo.meta.priority === "high"
                            ? "border-orange-400 text-orange-600"
                            : ""
                      }`}
                    >
                      {todo.meta.priority}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {clientNote.content ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {clientNote.content}
                </p>
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
