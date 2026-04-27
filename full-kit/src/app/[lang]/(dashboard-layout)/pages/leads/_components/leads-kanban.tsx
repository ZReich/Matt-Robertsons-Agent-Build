"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
  const [conversionDraft, setConversionDraft] = useState<ConversionDraft>(null)
  const [address, setAddress] = useState("")
  const [propertyType, setPropertyType] = useState("other")

  async function submitDeal() {
    if (!conversionDraft || !address.trim()) return
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
    if (response.ok) setConversionDraft(null)
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
              setAddress("")
              setPropertyType("other")
              setConversionDraft(moved)
            }
          }
        }}
      />
      <Dialog
        open={conversionDraft !== null}
        onOpenChange={(open) => !open && setConversionDraft(null)}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConversionDraft(null)}>
              Dismiss
            </Button>
            <Button onClick={submitDeal} disabled={!address.trim()}>
              Create deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
