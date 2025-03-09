import { savedCardsData } from "../../../../../_data/saved-cards"

import { Card } from "@/components/ui/card"
import { SavedCardsContent } from "./saved-cards-content"
import { SavedCardsHeader } from "./saved-cards-header"

export function SavedCards() {
  return (
    <Card>
      <SavedCardsHeader />
      <SavedCardsContent savedCards={savedCardsData} />
    </Card>
  )
}
