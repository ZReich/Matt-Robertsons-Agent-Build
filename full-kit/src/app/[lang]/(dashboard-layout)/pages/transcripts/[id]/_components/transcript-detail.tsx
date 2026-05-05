"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Briefcase, Loader2, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface Suggestion {
  contactId: string
  score: number
  source: string
  reason: string
  contactName: string | null
  contactCompany: string | null
  contactEmail: string | null
}

interface DealSuggestion {
  dealId: string
  contactId: string
  score: number
  source: string
  reason: string
  propertyAddress: string | null
  stage: string | null
  dealContactName: string | null
}

interface Props {
  commId: string
  currentContactId: string | null
  currentDealId: string | null
  currentDealLabel: string | null
  suggestions: Suggestion[]
  dealSuggestions: DealSuggestion[]
  lang: string
  sensitive: boolean
}

interface ContactSearchResult {
  id: string
  name: string
  company: string | null
  email: string | null
}

interface DealSearchResult {
  id: string
  propertyAddress: string | null
  stage: string | null
  contactName: string | null
  contactCompany: string | null
}

export function TranscriptDetail({
  commId,
  currentContactId,
  currentDealId,
  currentDealLabel,
  suggestions,
  dealSuggestions,
  lang,
  sensitive,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ContactSearchResult[]>([])
  const [searchPending, setSearchPending] = useState(false)
  const [dealQuery, setDealQuery] = useState("")
  const [dealResults, setDealResults] = useState<DealSearchResult[]>([])
  const [dealSearchPending, setDealSearchPending] = useState(false)

  async function attach(contactId: string): Promise<void> {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/communications/${commId}/attach-contact`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contactId }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(`Attach failed: ${body.error ?? res.statusText}`)
        return
      }
      // Navigate to the contact's activity tab.
      router.push(`/${lang}/pages/contacts/${contactId}?tab=activity`)
    } finally {
      setBusy(false)
    }
  }

  async function attachDeal(dealId: string): Promise<void> {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/communications/${commId}/attach-deal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dealId }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(`Attach to deal failed: ${body.error ?? res.statusText}`)
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  async function skipDeal(): Promise<void> {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/communications/${commId}/attach-deal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dealId: null }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(`Deal review failed: ${body.error ?? res.statusText}`)
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  async function searchContacts(q: string): Promise<void> {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setSearchPending(true)
    try {
      const res = await fetch(
        `/api/contacts?q=${encodeURIComponent(q)}&limit=10`
      )
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          items?: ContactSearchResult[]
        }
        setResults(Array.isArray(body.items) ? body.items.slice(0, 10) : [])
      }
    } finally {
      setSearchPending(false)
    }
  }

  async function searchDeals(q: string): Promise<void> {
    setDealQuery(q)
    if (q.trim().length < 2) {
      setDealResults([])
      return
    }
    setDealSearchPending(true)
    try {
      const res = await fetch(`/api/deals?q=${encodeURIComponent(q)}&limit=10`)
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          items?: DealSearchResult[]
        }
        setDealResults(Array.isArray(body.items) ? body.items.slice(0, 10) : [])
      }
    } finally {
      setDealSearchPending(false)
    }
  }

  if (sensitive) {
    return (
      <div className="grid gap-4">
        {dealSuggestions.length > 0 || currentDealId ? (
          <DealCard
            lang={lang}
            currentDealId={currentDealId}
            currentDealLabel={currentDealLabel}
            dealSuggestions={dealSuggestions}
            busy={busy}
            onAttachDeal={attachDeal}
            dealQuery={dealQuery}
            dealResults={dealResults}
            dealSearchPending={dealSearchPending}
            onDealQuery={searchDeals}
            onSkipDeal={skipDeal}
          />
        ) : (
          <DealSearchCard
            query={dealQuery}
            results={dealResults}
            pending={dealSearchPending}
            busy={busy}
            onQuery={searchDeals}
            onAttach={attachDeal}
            onSkip={skipDeal}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Attach to contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact suggestions disabled for this transcript (possible
              sensitive content). Use the search below to attach a contact
              manually.
            </p>
            <ContactSearch
              query={query}
              results={results}
              pending={searchPending}
              busy={busy}
              onQuery={searchContacts}
              onAttach={attach}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const showDealCard =
    dealSuggestions.length > 0 || Boolean(currentDealId)

  return (
    <div className="grid gap-4">
      {showDealCard ? (
        <DealCard
          lang={lang}
          currentDealId={currentDealId}
          currentDealLabel={currentDealLabel}
          dealSuggestions={dealSuggestions}
          busy={busy}
          onAttachDeal={attachDeal}
          dealQuery={dealQuery}
          dealResults={dealResults}
          dealSearchPending={dealSearchPending}
          onDealQuery={searchDeals}
          onSkipDeal={skipDeal}
        />
      ) : (
        <DealSearchCard
          query={dealQuery}
          results={dealResults}
          pending={dealSearchPending}
          busy={busy}
          onQuery={searchDeals}
          onAttach={attachDeal}
          onSkip={skipDeal}
        />
      )}
      <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {currentContactId
            ? "Attached"
            : suggestions.length > 0
              ? "Suggested contacts"
              : "Attach to contact"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {currentContactId ? (
          <p className="text-sm text-muted-foreground">
            This transcript is attached. To re-assign, search for a different
            contact below.
          </p>
        ) : null}

        {suggestions.length === 0 && !currentContactId ? (
          <p className="text-sm text-muted-foreground">
            No automatic suggestions for this transcript. Use search below.
          </p>
        ) : null}

        {suggestions.map((s) => (
          <div
            key={s.contactId + s.source}
            className="rounded-lg border p-3 flex items-center justify-between gap-3"
          >
            <div className="text-sm grid gap-0.5">
              <div className="font-medium">
                {s.contactName ?? `(unknown contact ${s.contactId.slice(0, 8)})`}
              </div>
              {s.contactCompany ? (
                <div className="text-muted-foreground text-xs">
                  {s.contactCompany}
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">{s.reason}</div>
              <div className="text-xs">
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {s.score} · {s.source.replace("_", " ")}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant={currentContactId === s.contactId ? "outline" : "default"}
              disabled={busy || currentContactId === s.contactId}
              onClick={() => attach(s.contactId)}
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : currentContactId === s.contactId ? (
                "Attached"
              ) : (
                <>
                  <UserPlus className="me-1 size-3" />
                  Attach
                </>
              )}
            </Button>
          </div>
        ))}

        <ContactSearch
          query={query}
          results={results}
          pending={searchPending}
          busy={busy}
          onQuery={searchContacts}
          onAttach={attach}
        />
      </CardContent>
    </Card>
    </div>
  )
}

function DealCard({
  lang,
  currentDealId,
  currentDealLabel,
  dealSuggestions,
  busy,
  onAttachDeal,
  dealQuery,
  dealResults,
  dealSearchPending,
  onDealQuery,
  onSkipDeal,
}: {
  lang: string
  currentDealId: string | null
  currentDealLabel: string | null
  dealSuggestions: DealSuggestion[]
  busy: boolean
  onAttachDeal: (dealId: string) => void
  dealQuery: string
  dealResults: DealSearchResult[]
  dealSearchPending: boolean
  onDealQuery: (q: string) => void
  onSkipDeal: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {currentDealId ? "Linked deal" : "Suggested deal"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {currentDealId && currentDealLabel ? (
          <div className="rounded-lg border bg-primary/5 p-3 flex items-center justify-between gap-3">
            <div className="text-sm grid gap-0.5">
              <div className="flex items-center gap-2 font-medium">
                <Briefcase className="size-4" />
                {currentDealLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                Transcript shows on this deal&apos;s timeline.
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={"/" + lang + "/pages/deals/" + currentDealId}>
                Open deal
              </a>
            </Button>
          </div>
        ) : null}
        {dealSuggestions.map((d) => (
          <DealSuggestionRow
            key={d.dealId + d.source}
            suggestion={d}
            isCurrent={currentDealId === d.dealId}
            busy={busy}
            onAttach={onAttachDeal}
          />
        ))}
        <DealSearch
          query={dealQuery}
          results={dealResults}
          pending={dealSearchPending}
          busy={busy}
          onQuery={onDealQuery}
          onAttach={onAttachDeal}
          onSkip={onSkipDeal}
        />
      </CardContent>
    </Card>
  )
}

function DealSuggestionRow({
  suggestion: d,
  isCurrent,
  busy,
  onAttach,
}: {
  suggestion: DealSuggestion
  isCurrent: boolean
  busy: boolean
  onAttach: (dealId: string) => void
}) {
  const sourceLabel = d.source.split("_").join(" ")
  return (
    <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
      <div className="text-sm grid gap-0.5">
        <div className="flex items-center gap-2 font-medium">
          <Briefcase className="size-4" />
          {d.propertyAddress ?? "(deal — no address)"}
        </div>
        {d.dealContactName ? (
          <div className="text-xs text-muted-foreground">
            Primary contact: {d.dealContactName}
            {d.stage ? " · stage: " + d.stage : ""}
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">{d.reason}</div>
        <div className="text-xs">
          <span className="rounded bg-muted px-1.5 py-0.5">
            {d.score} · {sourceLabel}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant={isCurrent ? "outline" : "default"}
        disabled={busy || isCurrent}
        onClick={() => onAttach(d.dealId)}
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin" />
        ) : isCurrent ? (
          "Linked"
        ) : (
          "Link to deal"
        )}
      </Button>
    </div>
  )
}

function DealSearchCard({
  query,
  results,
  pending,
  busy,
  onQuery,
  onAttach,
  onSkip,
}: {
  query: string
  results: DealSearchResult[]
  pending: boolean
  busy: boolean
  onQuery: (q: string) => void
  onAttach: (id: string) => void
  onSkip: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Link deal</CardTitle>
      </CardHeader>
      <CardContent>
        <DealSearch
          query={query}
          results={results}
          pending={pending}
          busy={busy}
          onQuery={onQuery}
          onAttach={onAttach}
          onSkip={onSkip}
        />
      </CardContent>
    </Card>
  )
}

function DealSearch({
  query,
  results,
  pending,
  busy,
  onQuery,
  onAttach,
  onSkip,
}: {
  query: string
  results: DealSearchResult[]
  pending: boolean
  busy: boolean
  onQuery: (q: string) => void
  onAttach: (id: string) => void
  onSkip: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input
          placeholder="Search deals by property or contact"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={onSkip}>
          No deal
        </Button>
      </div>
      {pending ? (
        <p className="text-xs text-muted-foreground">Searching...</p>
      ) : null}
      {results.length > 0 ? (
        <div className="grid gap-1">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              onClick={() => onAttach(r.id)}
              className="text-left rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <div className="font-medium">
                {r.propertyAddress ?? "(deal without address)"}
              </div>
              <div className="text-xs text-muted-foreground">
                {[r.contactName, r.contactCompany, r.stage]
                  .filter(Boolean)
                  .join(" - ") || "No contact"}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ContactSearch({
  query,
  results,
  pending,
  busy,
  onQuery,
  onAttach,
}: {
  query: string
  results: ContactSearchResult[]
  pending: boolean
  busy: boolean
  onQuery: (q: string) => void
  onAttach: (id: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Input
        placeholder="Search contacts by name, company, or email"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      {pending ? (
        <p className="text-xs text-muted-foreground">Searching…</p>
      ) : null}
      {results.length > 0 ? (
        <div className="grid gap-1">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              onClick={() => onAttach(r.id)}
              className="text-left rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {[r.company, r.email].filter(Boolean).join(" · ") || "—"}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
