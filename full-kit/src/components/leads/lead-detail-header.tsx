"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import type { LeadSource, LeadStatus } from "@prisma/client"

import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SourceBadge } from "./source-badge"
import { StatusChip } from "./status-chip"

interface LeadDetailHeaderProps {
  leadId: string
  name: string
  company: string | null
  metaLine: string
  leadSource: LeadSource
  leadStatus: LeadStatus
}

export function LeadDetailHeader({
  leadId,
  name,
  company,
  metaLine,
  leadSource,
  leadStatus,
}: LeadDetailHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionPending, setActionPending] = useState(false)

  async function patchStatus(next: LeadStatus): Promise<void> {
    setActionPending(true)
    try {
      const response = await fetch(`/api/vault/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadStatus: next }),
      })
      if (!response.ok) {
        toast({
          title: "Could not update lead",
          description: `Server returned ${response.status}`,
        })
        return
      }
      toast({ title: `Marked as ${next}` })
      startTransition(() => router.refresh())
    } finally {
      setActionPending(false)
    }
  }

  async function doConvert(): Promise<void> {
    setActionPending(true)
    try {
      const response = await fetch(`/api/vault/leads/${leadId}/convert`, {
        method: "POST",
      })
      if (!response.ok) {
        toast({
          title: "Convert failed",
          description: `Server returned ${response.status}`,
        })
        return
      }
      const body = (await response.json()) as {
        ok: true
        alreadyClient: boolean
        clientPath: string
      }
      toast({
        title: body.alreadyClient ? "Already a client" : "Converted to client",
        description: body.clientPath,
      })
      setConfirmOpen(false)
      startTransition(() => router.refresh())
    } finally {
      setActionPending(false)
    }
  }

  const disabled = isPending || actionPending || leadStatus === "converted"

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold text-foreground">
            {name}
            {company ? (
              <span className="text-muted-foreground"> - {company}</span>
            ) : null}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <SourceBadge source={leadSource} />
            <StatusChip status={leadStatus} />
            <span>{metaLine}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || leadStatus === "vetted"}
            onClick={() => void patchStatus("vetted")}
          >
            Vetted
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || leadStatus === "contacted"}
            onClick={() => void patchStatus("contacted")}
          >
            Contacted
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || leadStatus === "dropped"}
            onClick={() => void patchStatus("dropped")}
          >
            Drop
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => setConfirmOpen(true)}
          >
            Convert
          </Button>
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a client record for <strong>{name}</strong> and
              mark this lead as converted. If a client with the same email
              already exists, it will be reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={actionPending} onClick={doConvert}>
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
