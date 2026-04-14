import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Paperclip,
  Phone,
  Ruler,
  Shield,
  Smartphone,
  User,
} from "lucide-react"

import type {
  CommunicationMeta,
  DealDocument,
  DealMeta,
  MeetingMeta,
  TodoMeta,
} from "@/lib/vault"
import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DEAL_STAGE_LABELS, listNotes } from "@/lib/vault"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocLink } from "./_components/doc-link"

interface DealDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

const STAGE_COLORS: Record<string, string> = {
  prospecting:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  listing: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  marketing:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  showings:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  offer: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "under-contract":
    "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  "due-diligence":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  closing:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  closed:
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
}

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  office: "bg-blue-100 text-blue-800",
  retail: "bg-green-100 text-green-800",
  industrial: "bg-orange-100 text-orange-800",
  multifamily: "bg-purple-100 text-purple-800",
  land: "bg-amber-100 text-amber-800",
  "mixed-use": "bg-indigo-100 text-indigo-800",
  hospitality: "bg-pink-100 text-pink-800",
  medical: "bg-red-100 text-red-800",
  other: "bg-gray-100 text-gray-800",
}

const CHANNEL_ICONS: Record<string, ReactNode> = {
  email: <Mail className="size-4 text-blue-500" />,
  call: <Phone className="size-4 text-green-500" />,
  text: <MessageSquare className="size-4 text-violet-500" />,
  whatsapp: <Smartphone className="size-4 text-teal-500" />,
  meeting: <Calendar className="size-4 text-amber-500" />,
}

const DOC_TYPE_CONFIG: Record<
  DealDocument["type"],
  { icon: ReactNode; color: string; badgeClass: string }
> = {
  contract: {
    icon: <FileText className="size-5" />,
    color: "text-blue-500",
    badgeClass: "border-blue-200 text-blue-700",
  },
  inspection: {
    icon: <ClipboardList className="size-5" />,
    color: "text-orange-500",
    badgeClass: "border-orange-200 text-orange-700",
  },
  financial: {
    icon: <BarChart2 className="size-5" />,
    color: "text-emerald-500",
    badgeClass: "border-emerald-200 text-emerald-700",
  },
  title: {
    icon: <Shield className="size-5" />,
    color: "text-violet-500",
    badgeClass: "border-violet-200 text-violet-700",
  },
  marketing: {
    icon: <Megaphone className="size-5" />,
    color: "text-indigo-500",
    badgeClass: "border-indigo-200 text-indigo-700",
  },
  correspondence: {
    icon: <Mail className="size-5" />,
    color: "text-teal-500",
    badgeClass: "border-teal-200 text-teal-700",
  },
  other: {
    icon: <Paperclip className="size-5" />,
    color: "text-gray-500",
    badgeClass: "border-gray-200 text-gray-700",
  },
}

function makeTaskId(path: string): string {
  return path
    .replace(/[/\\]/g, "-")
    .replace(/\.md$/, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
}

function formatValue(value?: number): string {
  if (!value) return "—"
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString()}`
}

export async function generateMetadata({
  params,
}: DealDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const notes = await listNotes<DealMeta>("clients")
  const deal = notes.find(
    (n) => n.meta.type === "deal" && makeTaskId(n.path) === id
  )
  return { title: deal?.meta.property_address ?? "Deal Detail" }
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params

  const [dealNotes, todoNotes, commNotes, meetingNotes] = await Promise.all([
    listNotes<DealMeta>("clients"),
    listNotes<TodoMeta>("todos"),
    listNotes<CommunicationMeta>("communications"),
    listNotes<MeetingMeta>("meetings"),
  ])

  const dealNote = dealNotes.find(
    (n) => n.meta.type === "deal" && makeTaskId(n.path) === id
  )

  if (!dealNote) notFound()

  const deal = dealNote.meta

  // Fixed: strip [[...]] brackets when matching deal field
  const dealTodos = todoNotes.filter(
    (t) => t.meta.deal?.replace(/\[\[|\]\]/g, "") === deal.property_address
  )

  // Communications linked to this deal
  const dealComms = commNotes
    .filter(
      (c) => c.meta.deal?.replace(/\[\[|\]\]/g, "") === deal.property_address
    )
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  // Meetings linked to this deal
  const now = new Date()
  const dealMeetings = meetingNotes
    .filter(
      (m) => m.meta.deal?.replace(/\[\[|\]\]/g, "") === deal.property_address
    )
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  const clientName = deal.client?.replace(/\[\[|\]\]/g, "")

  return (
    <section className="container max-w-5xl grid gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="size-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{deal.property_address}</h1>
          </div>
          {clientName && (
            <p className="text-muted-foreground text-sm mt-1">{clientName}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge
              className={`${STAGE_COLORS[deal.stage] ?? "bg-gray-100 text-gray-700"} border-0 font-medium`}
            >
              {DEAL_STAGE_LABELS[deal.stage]}
            </Badge>
            {deal.property_type && (
              <Badge
                className={`${PROPERTY_TYPE_COLORS[deal.property_type] ?? "bg-gray-100 text-gray-700"} border-0 capitalize`}
              >
                {deal.property_type.replace("-", " ")}
              </Badge>
            )}
            {deal.value && (
              <Badge variant="outline" className="font-semibold">
                {formatValue(deal.value)}
              </Badge>
            )}
            {dealComms.length > 0 && (
              <Badge variant="outline">
                {dealComms.length} comm{dealComms.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comms">
            Communications ({dealComms.length})
          </TabsTrigger>
          <TabsTrigger value="meetings">
            Meetings ({dealMeetings.length})
          </TabsTrigger>
          <TabsTrigger value="files">
            Files ({(deal.documents ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="todos">Todos ({dealTodos.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent
          value="overview"
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span>{deal.property_address}</span>
              </div>
              {deal.property_type && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4 text-muted-foreground shrink-0" />
                  <span className="capitalize">
                    {deal.property_type.replace("-", " ")}
                  </span>
                </div>
              )}
              {deal.square_feet && (
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="size-4 text-muted-foreground shrink-0" />
                  <span>{deal.square_feet.toLocaleString()} sq ft</span>
                </div>
              )}
              {deal.value && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold">
                    {formatValue(deal.value)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Key Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal.listed_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> Listed
                  </span>
                  <span>
                    {format(new Date(deal.listed_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {deal.closing_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> Closing
                  </span>
                  <span className="font-medium">
                    {format(new Date(deal.closing_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Days in Stage
                </span>
                <span>
                  {deal.listed_date
                    ? Math.floor(
                        (Date.now() - new Date(deal.listed_date).getTime()) /
                          86_400_000
                      )
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {deal.key_contacts && Object.keys(deal.key_contacts).length > 0 && (
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3.5" /> Key Contacts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.entries(deal.key_contacts).map(([role, name]) => (
                    <div key={role} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {role.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(deal.tags ?? []).length > 0 && (
            <Card className="sm:col-span-2">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-1.5">
                  {(deal.tags ?? []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="capitalize text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Communications */}
        <TabsContent value="comms" className="mt-4 space-y-3">
          {dealComms.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No communications logged for this deal yet.
            </p>
          ) : (
            dealComms.map((comm) => {
              const contactName = comm.meta.contact?.replace(/\[\[|\]\]/g, "")
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
                          {contactName}
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
                      </div>
                      {comm.meta.subject && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {comm.meta.subject}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(
                          new Date(comm.meta.date),
                          "MMMM d, yyyy · h:mm a"
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Meetings */}
        <TabsContent value="meetings" className="mt-4 space-y-3">
          {dealMeetings.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No meetings recorded for this deal.
            </p>
          ) : (
            dealMeetings.map((meeting) => {
              const isPast = new Date(meeting.meta.date) < now
              return (
                <Card key={meeting.path} className={isPast ? "opacity-75" : ""}>
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{meeting.meta.title}</p>
                      {meeting.meta.contact && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {meeting.meta.contact}
                        </p>
                      )}
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

        {/* Files */}
        <TabsContent value="files" className="mt-4 space-y-3">
          {(deal.documents ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No documents attached to this deal yet. Add a{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                documents:
              </code>{" "}
              array to the vault file to track files.
            </p>
          ) : (
            (deal.documents ?? []).map((doc, i) => {
              const cfg = DOC_TYPE_CONFIG[doc.type] ?? DOC_TYPE_CONFIG.other
              return (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`shrink-0 mt-0.5 ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{doc.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${cfg.badgeClass}`}
                        >
                          {doc.type}
                        </Badge>
                        {doc.date_added && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(doc.date_added), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <DocLink url={doc.url ?? ""} />
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Todos */}
        <TabsContent value="todos" className="mt-4 space-y-3">
          {dealTodos.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No todos linked to this deal.
            </p>
          ) : (
            dealTodos.map((todo) => (
              <Card key={todo.path}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckSquare
                      className={`size-4 shrink-0 ${
                        todo.meta.status === "done"
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          todo.meta.status === "done"
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
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

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {dealNote.content ? (
                <MarkdownRenderer content={dealNote.content} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No notes for this deal yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
