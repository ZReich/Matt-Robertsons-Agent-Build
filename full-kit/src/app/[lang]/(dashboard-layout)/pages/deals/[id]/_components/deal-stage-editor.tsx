"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"

import type { DealStage } from "@prisma/client"

import {
  DEAL_STAGES,
  DEAL_STAGE_PROBABILITY,
} from "@/lib/pipeline/stage-probability"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type DetectionResult = {
  fromStage: DealStage
  proposedStage: DealStage
  confidence: number
  reasoning: string
  supportingCommunicationIds: string[]
  modelUsed: string
}

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
  const [detecting, setDetecting] = useState(false)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)

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
    if (response.ok) {
      // Clear the detection panel — the stage now reflects whatever the
      // user picked, so a stale "marketing → offer" proposal sitting in
      // the UI would be misleading.
      setDetection(null)
      setDetectionError(null)
      router.refresh()
    }
  }

  async function detect() {
    setDetecting(true)
    setDetectionError(null)
    setDetection(null)
    try {
      const response = await fetch(`/api/deals/${dealId}/detect-stage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
      const payload = (await response.json().catch(() => ({}))) as {
        detection?: DetectionResult
        error?: string
      }
      if (!response.ok) {
        setDetectionError(payload.error ?? `error (${response.status})`)
        return
      }
      if (payload.detection) setDetection(payload.detection)
    } catch (error) {
      setDetectionError(
        error instanceof Error ? error.message : "request failed"
      )
    } finally {
      setDetecting(false)
    }
  }

  function applyDetection() {
    if (!detection) return
    setNextStage(detection.proposedStage)
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

      <div className="mt-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={detect}
            disabled={detecting}
          >
            <Sparkles className="me-2 size-3.5" />
            {detecting ? "Detecting…" : "Detect stage from emails"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Reads recent communications and proposes a stage with confidence.
          </span>
        </div>
        {detectionError ? (
          <p className="mt-2 text-xs text-destructive">{detectionError}</p>
        ) : null}
        {detection ? (
          <div className="mt-2 rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium capitalize">
                {detection.fromStage.replace(/_/g, " ")}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium capitalize">
                {detection.proposedStage.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-muted-foreground">
                {(detection.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {detection.reasoning}
            </p>
            {detection.supportingCommunicationIds.length > 0 ? (
              <p className="mt-1 break-all text-xs text-muted-foreground">
                Evidence: {detection.supportingCommunicationIds.join(", ")}
              </p>
            ) : null}
            {detection.proposedStage !== detection.fromStage &&
            detection.proposedStage !== nextStage ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={applyDetection}
                disabled={saving}
              >
                Use this stage
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
