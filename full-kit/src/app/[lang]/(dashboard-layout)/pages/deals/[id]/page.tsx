import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  MessageSquare,
  Ruler,
  User,
} from "lucide-react"

import type { Metadata } from "next"

import { getAiSuggestionState } from "@/lib/ai/suggestions"
import { getAttachmentSummary } from "@/lib/communications/attachment-types"
import { DEAL_STAGE_LABELS } from "@/lib/pipeline/stage-probability"
import { computeWeightedCommission } from "@/lib/pipeline/weighted-commission"
import { db } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DealStageEditor } from "./_components/deal-stage-editor"
import { DocLink } from "./_components/doc-link"
import { AttachmentSummaryInline } from "@/components/communications/attachment-summary-inline"
import { LeadAISuggestions } from "@/components/leads/lead-ai-suggestions"

interface DealDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

function decimalToNumber(
  value: { toNumber(): number } | number | null | undefined
) {
  if (value === null || value === undefined) return null
  return typeof value === "number" ? value : value.toNumber()
}

export async function generateMetadata({
  params,
}: DealDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const deal = await db.deal.findUnique({
    where: { id },
    select: { propertyAddress: true },
  })
  return { title: deal?.propertyAddress ?? "Deal Detail" }
}

export const dynamic = "force-dynamic"

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id, lang } = await params

  const [deal, aiSuggestions] = await Promise.all([
    db.deal.findUnique({
      where: { id },
      include: {
        contact: true,
        communications: { orderBy: { date: "desc" } },
        meetings: { orderBy: { date: "desc" } },
        documents: { orderBy: { dateAdded: "desc" } },
        todos: { orderBy: { createdAt: "desc" } },
      },
    }),
    getAiSuggestionState({ entityType: "deal", entityId: id }),
  ])

  if (!deal) notFound()
  // The detail render assumes a parseable property. Buyer-rep deals (no
  // property yet) and seller-rep deals whose lead inquiry didn't yield a usable
  // address are not surfaced here yet — they'll get their own UI later. For now
  // route them to a 404 instead of cluttering this page with null guards.
  if (!deal.propertyAddress || !deal.propertyType) notFound()

  const value = decimalToNumber(deal.value)
  const commissionRate = decimalToNumber(deal.commissionRate) ?? 0.03
  const weightedCommission = computeWeightedCommission({
    stage: deal.stage,
    value,
    commissionRate,
    probability: deal.probability,
  })
  const ageDate = deal.stageChangedAt ?? deal.listedDate ?? deal.createdAt
  const daysInStage = Math.max(
    0,
    Math.floor((Date.now() - ageDate.getTime()) / 86_400_000)
  )

  return (
    <section className="container grid max-w-5xl gap-6 p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="size-7 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{deal.propertyAddress}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {deal.contact.name}
            {deal.contact.company ? ` - ${deal.contact.company}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="border-0 bg-muted text-foreground">
              {DEAL_STAGE_LABELS[deal.stage]}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {deal.propertyType.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">
              {value !== null ? formatCurrency(value) : "-"}
            </Badge>
            <Badge variant="outline">
              Weighted{" "}
              {weightedCommission !== null
                ? formatCurrency(weightedCommission)
                : "-"}
            </Badge>
          </div>
        </div>
      </div>

      <DealStageEditor
        dealId={deal.id}
        stage={deal.stage}
        probability={deal.probability}
      />
      <Separator />

      <Tabs defaultValue="overview">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comms">
            Communications ({deal.communications.length})
          </TabsTrigger>
          <TabsTrigger value="meetings">
            Meetings ({deal.meetings.length})
          </TabsTrigger>
          <TabsTrigger value="files">
            Files ({deal.documents.length})
          </TabsTrigger>
          <TabsTrigger value="todos">Todos ({deal.todos.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {deal.propertyAddress}
              </div>
              <div className="flex items-center gap-2 capitalize">
                <Building2 className="size-4 text-muted-foreground" />
                {deal.propertyType.replace(/_/g, " ")}
              </div>
              {deal.squareFeet ? (
                <div className="flex items-center gap-2">
                  <Ruler className="size-4 text-muted-foreground" />
                  {deal.squareFeet.toLocaleString()} sq ft
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-muted-foreground" />
                {value !== null ? formatCurrency(value) : "-"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Probability</span>
                <span>{deal.probability ?? "stage default"}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission rate</span>
                <span>{Math.round(commissionRate * 10000) / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3.5" /> Days in stage
                </span>
                <span>{daysInStage}</span>
              </div>
              {deal.listedDate ? (
                <div className="flex justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="size-3.5" /> Listed
                  </span>
                  <span>{format(deal.listedDate, "MMM d, yyyy")}</span>
                </div>
              ) : null}
              {deal.closingDate ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closing</span>
                  <span>{format(deal.closingDate, "MMM d, yyyy")}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="size-3.5" /> Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{deal.contact.name}</p>
              <p>
                {deal.contact.email ?? "No email"} ·{" "}
                {deal.contact.phone ?? "No phone"}
              </p>
              {deal.contact.notes ? (
                <p className="mt-2">{deal.contact.notes}</p>
              ) : null}
            </CardContent>
          </Card>
          <div className="sm:col-span-2">
            <LeadAISuggestions state={aiSuggestions} lang={lang} />
          </div>
        </TabsContent>

        <TabsContent value="comms" className="mt-4 space-y-3">
          {deal.communications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No communications logged.
            </p>
          ) : (
            deal.communications.map((comm) => (
              <Card key={comm.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <MessageSquare className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {comm.subject ?? comm.channel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(comm.date, "MMMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <AttachmentSummaryInline
                    summary={getAttachmentSummary(comm.metadata)}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="meetings" className="mt-4 space-y-3">
          {deal.meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meetings recorded.
            </p>
          ) : (
            deal.meetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(meeting.date, "MMMM d, yyyy · h:mm a")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-4 space-y-3">
          {deal.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents attached.
            </p>
          ) : (
            deal.documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="flex gap-3">
                    <FileText className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.docType}
                      </p>
                    </div>
                  </div>
                  <DocLink url={doc.url ?? ""} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="todos" className="mt-4 space-y-3">
          {deal.todos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No todos linked.</p>
          ) : (
            deal.todos.map((todo) => (
              <Card key={todo.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckSquare className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{todo.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {todo.status}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {deal.notes ? (
                <MarkdownRenderer content={deal.notes} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No notes for this deal.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
