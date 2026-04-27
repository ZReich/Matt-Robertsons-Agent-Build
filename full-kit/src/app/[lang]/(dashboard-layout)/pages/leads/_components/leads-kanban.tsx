"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import type {
  BoardColumn,
  LeadCard as LeadCardData,
} from "@/lib/pipeline/server/board"
import type { LeadStatus } from "@prisma/client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KanbanBoard } from "@/components/kanban/kanban-board"
import { LeadCard } from "./lead-card"
import { LeadColumnHeader } from "./lead-column-header"

type ConversionDraft = LeadCardData | null

export function LeadsKanban({
  columns,
}: {
  columns: BoardColumn<LeadCardData, LeadStatus>[]
}) {
  const router = useRouter()
  const params = useParams()
  const lang = typeof params.lang === "string" ? params.lang : "en"
  const [conversionDraft, setConversionDraft] = useState<ConversionDraft>(null)
  const [address, setAddress] = useState("")
  const [propertyType, setPropertyType] = useState("other")
  const [dealError, setDealError] = useState<string | null>(null)
  const [isCreatingDeal, setIsCreatingDeal] = useState(false)

  async function submitDeal() {
    if (!conversionDraft) return
    if (!address.trim()) {
      setDealError("Property address is required before creating a deal.")
      return
    }
    setIsCreatingDeal(true)
    setDealError(null)
    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: conversionDraft.id,
          propertyAddress: address,
          propertyType,
          value: conversionDraft.estimatedValue,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        deal?: { id?: string }
      } | null
      if (!response.ok) {
        setDealError(payload?.error ?? "Deal creation failed.")
        return
      }
      toast.success("Deal created")
      setConversionDraft(null)
      router.refresh()
      router.push(
        payload?.deal?.id
          ? `/${lang}/pages/deals/${payload.deal.id}`
          : `/${lang}/pages/deals`
      )
    } finally {
      setIsCreatingDeal(false)
    }
  }

  return (
    <>
      <KanbanBoard
        columns={columns}
        renderCard={(card) => <LeadCard card={card} />}
        renderColumnHeader={(column) => <LeadColumnHeader column={column} />}
        onMove={async (move) => {
          const response = await fetch(`/api/vault/leads/${move.cardId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ leadStatus: move.toColumnId }),
          })
          if (!response.ok) throw new Error("Lead status update failed")
          router.refresh()
          if (move.toColumnId === "converted") {
            const moved = columns
              .flatMap((column) => column.cards)
              .find((card) => card.id === move.cardId)
            if (moved) {
              setAddress(moved.propertyName ?? "")
              setPropertyType("other")
              setDealError(null)
              setConversionDraft(moved)
            }
          }
        }}
      />
      <Dialog
        open={conversionDraft !== null}
        onOpenChange={(open) => {
          if (open) return
          setConversionDraft(null)
          setDealError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create deal from converted lead</DialogTitle>
            <DialogDescription>
              Seeded from {conversionDraft?.name}. Dismiss to keep the lead
              converted without creating a deal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="propertyAddress">Property address</Label>
              <Input
                id="propertyAddress"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="propertyType">Property type</Label>
              <select
                id="propertyType"
                value={propertyType}
                onChange={(event) => setPropertyType(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="office">Office</option>
                <option value="retail">Retail</option>
                <option value="industrial">Industrial</option>
                <option value="multifamily">Multifamily</option>
                <option value="land">Land</option>
                <option value="mixed_use">Mixed use</option>
                <option value="hospitality">Hospitality</option>
                <option value="medical">Medical</option>
                <option value="other">Other</option>
              </select>
            </div>
            {dealError ? (
              <p className="text-sm text-destructive">{dealError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isCreatingDeal}
              onClick={() => {
                setConversionDraft(null)
                setDealError(null)
              }}
            >
              Dismiss
            </Button>
            <Button
              onClick={submitDeal}
              disabled={isCreatingDeal || !address.trim()}
            >
              {isCreatingDeal ? "Creating..." : "Create deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
