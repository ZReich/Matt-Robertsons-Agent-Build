"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Props {
  initial: {
    autoSendNewLeadReplies: boolean
    autoSendDailyMatchReplies: boolean
    autoMatchScoreThreshold: number
    dailyMatchPerContactCap: number
    leaseRenewalLookaheadMonths: number
    autoSendLeaseRenewalReplies: boolean
  }
}

export function AutomationForm({ initial }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [submitting, setSubmitting] = useState(false)

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/settings/automation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      settings?: typeof initial
      error?: string
    }
    if (!res.ok || !json.ok) {
      toast.error(json.error ?? "Save failed")
      return false
    }
    if (json.settings) setForm(json.settings)
    return true
  }

  async function toggle(field: keyof typeof initial, value: boolean | number) {
    setSubmitting(true)
    try {
      const ok = await patch({ [field]: value })
      if (ok) {
        toast.success("Saved")
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Auto-send</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex items-start justify-between gap-6">
            <div className="grid gap-1">
              <Label className="text-sm font-medium">
                Auto-send replies to new lead inquiries
              </Label>
              <p className="text-xs text-muted-foreground">
                When OFF (recommended starting state): inbound platform leads
                generate a draft reply that sits in the Pending Replies queue
                until you click Send. When ON: the AI draft is sent
                automatically from Matt&apos;s mailbox the moment a lead
                arrives.
              </p>
            </div>
            <Switch
              checked={form.autoSendNewLeadReplies}
              disabled={submitting}
              onCheckedChange={(v) => toggle("autoSendNewLeadReplies", v)}
            />
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="grid gap-1">
              <Label className="text-sm font-medium">
                Auto-send Daily Listings matches
              </Label>
              <p className="text-xs text-muted-foreground">
                When ON: every morning, the Daily Listings email is parsed, each
                new listing is scored against criteria-tagged contacts, and
                matches above the threshold get a draft sent automatically. When
                OFF: drafts are queued for review.
              </p>
            </div>
            <Switch
              checked={form.autoSendDailyMatchReplies}
              disabled={submitting}
              onCheckedChange={(v) => toggle("autoSendDailyMatchReplies", v)}
            />
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="grid gap-1">
              <Label className="text-sm font-medium">
                Auto-send lease-renewal outreach
              </Label>
              <p className="text-xs text-muted-foreground">
                When ON: the daily lease-renewal sweep auto-sends drafted
                re-engagement emails via Graph instead of queueing them as
                Pending Replies. Defaults OFF — past-client outreach has a
                different audience and risk profile than current-prospect
                daily-match alerts. Recommend reviewing the first batch by hand
                before flipping this on.
              </p>
            </div>
            <Switch
              checked={form.autoSendLeaseRenewalReplies}
              disabled={submitting}
              onCheckedChange={(v) => toggle("autoSendLeaseRenewalReplies", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match scoring</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="threshold" className="text-sm font-medium">
              Auto-match score threshold (50–100)
            </Label>
            <Input
              id="threshold"
              type="number"
              min={50}
              max={100}
              value={form.autoMatchScoreThreshold}
              disabled={submitting}
              onChange={(e) =>
                setForm({
                  ...form,
                  autoMatchScoreThreshold: Number(e.target.value) || 50,
                })
              }
              onBlur={() =>
                toggle("autoMatchScoreThreshold", form.autoMatchScoreThreshold)
              }
            />
            <p className="text-xs text-muted-foreground">
              Below this, matches are logged but no draft is created.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cap" className="text-sm font-medium">
              Daily-match cap per contact (1–20)
            </Label>
            <Input
              id="cap"
              type="number"
              min={1}
              max={20}
              value={form.dailyMatchPerContactCap}
              disabled={submitting}
              onChange={(e) =>
                setForm({
                  ...form,
                  dailyMatchPerContactCap: Number(e.target.value) || 1,
                })
              }
              onBlur={() =>
                toggle("dailyMatchPerContactCap", form.dailyMatchPerContactCap)
              }
            />
            <p className="text-xs text-muted-foreground">
              Prevents spamming a contact whose criteria matches many new
              listings on a busy day.
            </p>
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="leaseLookahead" className="text-sm font-medium">
              Lease-renewal lookahead (1–24 months)
            </Label>
            <Input
              id="leaseLookahead"
              type="number"
              min={1}
              max={24}
              value={form.leaseRenewalLookaheadMonths}
              disabled={submitting}
              onChange={(e) =>
                setForm({
                  ...form,
                  leaseRenewalLookaheadMonths: Number(e.target.value) || 6,
                })
              }
              onBlur={() =>
                toggle(
                  "leaseRenewalLookaheadMonths",
                  form.leaseRenewalLookaheadMonths
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              How many months ahead of <code>leaseEndDate</code> the daily
              renewal sweep starts firing. Default 6 — Matt&apos;s typical
              re-engagement window. The first sweep that lands inside this
              window per lease creates a Todo + calendar event + draft
              re-engagement email.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Heads up</p>
        <ul className="grid gap-1">
          <li>
            • Auto-send requires the Azure app registration to have{" "}
            <code>Mail.Send</code> permission with admin consent. If you flip it
            on and Graph returns 403, the draft falls back to the queue.
          </li>
          <li>
            • Sensitive emails (containing financial keywords) always skip
            auto-send regardless of these toggles.
          </li>
          <li>• Toggles save on click; numeric inputs save on blur.</li>
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criteria backfill</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Scan contacts touched in the last 90 days, ask DeepSeek to read
            their email history, and auto-populate <code>searchCriteria</code>{" "}
            for anyone who has expressed buyer/tenant intent. Skips contacts
            with closed deals, contacts already tagged with criteria, and
            anything that trips the sensitive-content filter.
          </p>
          <p className="text-xs text-muted-foreground">
            Costs roughly $0.001–0.003 per contact via DeepSeek. Pick how many
            to process below — &quot;All&quot; covers the full database (~2,300
            today) for around $4–7. Re-runs are safe; already-tagged contacts
            are skipped automatically.
          </p>
          <BackfillButton />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={async () => {
            const ok = await patch({
              autoSendNewLeadReplies: false,
              autoSendDailyMatchReplies: false,
              autoMatchScoreThreshold: 80,
              dailyMatchPerContactCap: 2,
              leaseRenewalLookaheadMonths: 6,
              autoSendLeaseRenewalReplies: false,
            })
            if (ok) {
              toast.success("Reset to defaults")
              router.refresh()
            }
          }}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  )
}

function BackfillButton() {
  const [running, setRunning] = useState(false)
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [contactLimit, setContactLimit] = useState<number>(100)
  const [lookbackDays, setLookbackDays] = useState<number>(90)
  const ALL_CONTACTS = 5000

  async function run(dryRun: boolean) {
    if (!dryRun && contactLimit > 500) {
      const ok = window.confirm(
        `You're about to run criteria extraction on up to ${contactLimit.toLocaleString()} contacts. Estimated DeepSeek cost: roughly $${(contactLimit * 0.002).toFixed(2)}. This can take several minutes. Continue?`
      )
      if (!ok) return
    }
    setRunning(true)
    try {
      const res = await fetch("/api/settings/criteria-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookbackDays,
          contactLimit,
          dryRun,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        scanned?: number
        criteriaSet?: number
        noIntent?: number
        skipped?: number
        errored?: number
        error?: string
      }
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Backfill failed")
        return
      }
      const summary = `Scanned ${json.scanned} · ${json.criteriaSet} tagged · ${json.noIntent} no intent · ${json.skipped} skipped · ${json.errored} errors${dryRun ? " (DRY RUN — nothing saved)" : ""}`
      setLastSummary(summary)
      toast.success(summary, { duration: 10_000 })
    } finally {
      setRunning(false)
    }
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="backfill-limit" className="text-xs font-medium">
            Contact limit
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="backfill-limit"
              type="number"
              min={1}
              max={ALL_CONTACTS}
              value={contactLimit}
              disabled={running}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n))
                  setContactLimit(Math.max(1, Math.min(ALL_CONTACTS, n)))
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={running}
              onClick={() => setContactLimit(ALL_CONTACTS)}
              title={`Sets the limit to ${ALL_CONTACTS} — effectively all contacts in the DB today`}
            >
              All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            How many contacts to scan in one run. Use the &quot;All&quot; button
            for the full ~2,300-contact sweep.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="backfill-lookback" className="text-xs font-medium">
            Lookback days (7–365)
          </Label>
          <Input
            id="backfill-lookback"
            type="number"
            min={7}
            max={365}
            value={lookbackDays}
            disabled={running}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n))
                setLookbackDays(Math.max(7, Math.min(365, n)))
            }}
          />
          <p className="text-xs text-muted-foreground">
            Only scan contacts whose communications/updates land within this
            window.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run(true)}
          disabled={running}
        >
          {running ? "Running…" : "Dry run (no writes)"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => run(false)}
          disabled={running}
        >
          {running
            ? "Running…"
            : `Run backfill (up to ${contactLimit.toLocaleString()} contacts)`}
        </Button>
      </div>
      {lastSummary ? (
        <p className="text-xs text-muted-foreground">{lastSummary}</p>
      ) : null}
    </div>
  )
}
