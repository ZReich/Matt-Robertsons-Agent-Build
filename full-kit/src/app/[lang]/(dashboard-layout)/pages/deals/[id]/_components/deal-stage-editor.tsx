"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import type { DealStage } from "@prisma/client"

import {
  DEAL_STAGES,
  DEAL_STAGE_PROBABILITY,
} from "@/lib/pipeline/stage-probability"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DealStageEditor({
  dealId,
  stage,
  probability,
}: {
  dealId: string
  stage: DealStage
  probability: number | null
}) {
  const router = useRouter()
  const [nextStage, setNextStage] = useState<DealStage>(stage)
  const [nextProbability, setNextProbability] = useState<string>(
    probability?.toString() ?? ""
  )
  const [saving, setSaving] = useState(false)

  async function save(resetProbability = false) {
    setSaving(true)
    const body: Record<string, unknown> = { stage: nextStage }
    body.probability =
      resetProbability || nextProbability.trim() === ""
        ? null
        : Number(nextProbability)
    const response = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (response.ok) router.refresh()
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 text-sm font-semibold">Pipeline controls</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <select
          value={nextStage}
          onChange={(event) => setNextStage(event.target.value as DealStage)}
          className="h-9 rounded-md border bg-background px-3 text-sm capitalize"
        >
          {DEAL_STAGES.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          max={100}
          value={nextProbability}
          onChange={(event) => setNextProbability(event.target.value)}
          placeholder={`${DEAL_STAGE_PROBABILITY[nextStage]}%`}
        />
        <Button onClick={() => save(false)} disabled={saving}>
          Save
        </Button>
      </div>
      <Button
        className="mt-2"
        variant="ghost"
        size="sm"
        onClick={() => save(true)}
        disabled={saving}
      >
        Reset probability to stage default ({DEAL_STAGE_PROBABILITY[nextStage]}
        %)
      </Button>
    </div>
  )
}
