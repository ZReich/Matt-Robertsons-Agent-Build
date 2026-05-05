"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"

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

interface Props {
  commId: string
  currentContactId: string | null
  suggestions: Suggestion[]
  lang: string
  sensitive: boolean
}

interface ContactSearchResult {
  id: string
  name: string
  company: string | null
  email: string | null
}

export function TranscriptDetail({
  commId,
  currentContactId,
  suggestions,
  lang,
  sensitive,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ContactSearchResult[]>([])
  const [searchPending, setSearchPending] = useState(false)

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

  if (sensitive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Attach to contact</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Suggestions disabled for this transcript. Use the search below
            to attach a contact manually.
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
    )
  }

  return (
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
