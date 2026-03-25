import type { Metadata } from "next"

import { DEAL_STAGE_LABELS, listNotes } from "@/lib/vault"
import type { DealMeta, DealStage } from "@/lib/vault"
import type { ColumnType, TaskType } from "./types"

import { Kanban } from "./_components/kanban"
import { KanbanWrapper } from "./_components/kanban-wrapper"

export const metadata: Metadata = {
  title: "Pipeline",
}

const CRE_STAGES: DealStage[] = [
  "prospecting",
  "listing",
  "marketing",
  "showings",
  "offer",
  "under-contract",
  "due-diligence",
  "closing",
  "closed",
]

export default async function PipelinePage() {
  const notes = await listNotes<DealMeta>("clients")
  const deals = notes.filter((n) => n.meta.type === "deal")

  const columns: ColumnType[] = CRE_STAGES.map((stage, order) => {
    const stageDeals = deals.filter((d) => d.meta.stage === stage)

    const tasks: TaskType[] = stageDeals.map((deal, taskIndex) => ({
      // URL-safe ID derived from the vault path
      id: deal.path
        .replace(/[/\\]/g, "-")
        .replace(/\.md$/, "")
        .replace(/\s+/g, "-")
        .toLowerCase(),
      columnId: stage,
      order: taskIndex,
      title: deal.meta.property_address,
      description: deal.meta.client?.replace(/\[\[|\]\]/g, ""),
      label: deal.meta.property_type,
      comments: [],
      assigned: [],
      dueDate: deal.meta.closing_date
        ? new Date(deal.meta.closing_date)
        : new Date(),
      attachments: [],
      // CRE deal extensions
      dealPath: deal.path,
      dealValue: deal.meta.value,
      dealPropertyType: deal.meta.property_type,
      dealClientName: deal.meta.client?.replace(/\[\[|\]\]/g, ""),
      dealListedDate: deal.meta.listed_date,
    }))

    return {
      id: stage,
      order,
      title: DEAL_STAGE_LABELS[stage],
      tasks,
    }
  })

  return (
    <KanbanWrapper kanbanData={columns}>
      <Kanban />
    </KanbanWrapper>
  )
}
