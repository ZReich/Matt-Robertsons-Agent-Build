import type { Metadata } from "next"

import { formatDistanceToNow } from "date-fns"

import { getAutomationSettings } from "@/lib/system-state/automation-settings"
import { getLastDailyListingsSweep } from "@/lib/system-state/last-daily-listings-sweep"

import { AutomationForm } from "./_components/automation-form"

export const metadata: Metadata = {
  title: "Automation settings",
}

export const dynamic = "force-dynamic"

export default async function AutomationSettingsPage() {
  const [settings, lastSweep] = await Promise.all([
    getAutomationSettings(),
    getLastDailyListingsSweep(),
  ])
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">Automation</h2>
        <p className="text-sm text-muted-foreground">
          Control how aggressively the AI assistant sends emails on Matt&apos;s
          behalf. Defaults are conservative — flip toggles on as you build
          confidence in the drafts.
        </p>
      </div>
      <LastDailyListingsSweepLine lastSweep={lastSweep} />
      <AutomationForm initial={settings} />
    </div>
  )
}

function LastDailyListingsSweepLine({
  lastSweep,
}: {
  lastSweep: Awaited<ReturnType<typeof getLastDailyListingsSweep>>
}) {
  if (!lastSweep) {
    return (
      <div
        data-testid="last-daily-listings-sweep"
        className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
      >
        Last Daily Listings sweep:{" "}
        <span className="text-foreground">never run</span>. The cron is
        configured for 9am Mountain Time (15:00 UTC) once deployed.
      </div>
    )
  }
  const ranAt = new Date(lastSweep.ranAt)
  const relative = formatDistanceToNow(ranAt, { addSuffix: true })
  return (
    <div
      data-testid="last-daily-listings-sweep"
      title={lastSweep.ranAt}
      className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
      Last Daily Listings sweep:{" "}
      <span className="text-foreground">{relative}</span> ·{" "}
      {lastSweep.processed}/{lastSweep.candidates} emails processed ·{" "}
      {lastSweep.listingsParsed} listings parsed · {lastSweep.draftsCreated}{" "}
      drafts created · {lastSweep.draftsSent} sent · {lastSweep.errors} errors
    </div>
  )
}
