import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import {
  Calendar,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Smartphone,
  User,
} from "lucide-react"
import { format } from "date-fns"

import { listNotes, normalizeEntityRef } from "@/lib/vault"
import type { CommunicationMeta, ContactMeta, MeetingMeta } from "@/lib/vault"

import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { matchTranscriptsToMeetings } from "@/lib/transcript-matching"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ContactDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export async function generateMetadata({
  params,
}: ContactDetailPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }
}

const CHANNEL_ICONS: Record<string, ReactNode> = {
  email: <Mail className="size-4 text-blue-500" />,
  call: <Phone className="size-4 text-green-500" />,
  text: <MessageSquare className="size-4 text-violet-500" />,
  whatsapp: <Smartphone className="size-4 text-teal-500" />,
  meeting: <Calendar className="size-4 text-amber-500" />,
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const { id } = await params

  const [contactNotes, meetingNotes, commNotes] = await Promise.all([
    listNotes<ContactMeta>("contacts"),
    listNotes<MeetingMeta>("meetings"),
    listNotes<CommunicationMeta>("communications"),
  ])

  const contactNote = contactNotes.find((n) => {
    const filename = n.path.split("/").pop() ?? n.path
    const slug = filename
      .replace(/\.md$/, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
    return slug === id
  })

  if (!contactNote) notFound()

  const contact = contactNote.meta

  const contactMeetings = meetingNotes
    .filter((m) => normalizeEntityRef(m.meta.contact ?? "") === contact.name)
    .sort(
      (a, b) =>
        new Date(a.meta.date).getTime() - new Date(b.meta.date).getTime()
    )

  const contactComms = commNotes
    .filter((c) => normalizeEntityRef(c.meta.contact ?? "") === contact.name)
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  // Auto-match Plaud call transcripts to meetings
  const transcriptMatches = matchTranscriptsToMeetings(
    contactComms,
    contactMeetings
  )

  const now = new Date()
  const upcomingMeetings = contactMeetings.filter(
    (m) => new Date(m.meta.date) >= now
  )

  const totalActivity = contactComms.length + contactMeetings.length

  return (
    <section className="container max-w-3xl grid gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <User className="size-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          {(contact.role || contact.company) && (
            <p className="text-muted-foreground">
              {[contact.role, contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {upcomingMeetings.length > 0 && (
              <Badge variant="secondary">
                {upcomingMeetings.length} upcoming meeting
                {upcomingMeetings.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {contactComms.length > 0 && (
              <Badge variant="outline">
                {contactComms.length} comm
                {contactComms.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({totalActivity})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {contact.address}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {upcomingMeetings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingMeetings.slice(0, 3).map((m) => (
                  <div key={m.path} className="flex justify-between text-sm">
                    <span className="font-medium">{m.meta.title}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(m.meta.date), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {contactComms.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Communications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contactComms.slice(0, 3).map((c) => (
                  <div key={c.path} className="flex items-center gap-3 text-sm">
                    <span className="shrink-0">
                      {CHANNEL_ICONS[c.meta.channel] ?? (
                        <MessageSquare className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="flex-1 truncate">
                      {c.meta.subject ?? c.meta.channel}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(c.meta.date), "MMM d")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Tab — unified timeline */}
        <TabsContent value="activity" className="mt-4">
          {totalActivity === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No activity recorded for this contact yet.
            </p>
          ) : (
            <ActivityTimeline
              communications={contactComms}
              meetings={contactMeetings}
              todos={[]}
              transcriptMatches={transcriptMatches}
            />
          )}
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {contactNote.content ? (
                <MarkdownRenderer content={contactNote.content} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No notes for this contact yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
