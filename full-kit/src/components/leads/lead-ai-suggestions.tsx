import { Sparkles } from "lucide-react"

export interface LeadAISuggestionsProps {
  contactId: string
  leadId?: string
}

export function LeadAISuggestions(_props: LeadAISuggestionsProps) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase text-amber-500">
        <Sparkles className="size-3.5" />
        AI Suggestions
      </div>
      <p className="text-xs italic text-muted-foreground">
        AI suggestions will appear here once this lead is processed.
      </p>
    </div>
  )
}
