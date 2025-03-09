import { z } from "zod"

import { cardSchema } from "../../../../_schemas/card-schema"

import { CardContent } from "@/components/ui/card"
import { SavedCardsList } from "./saved-cards-list"

type CardType = z.infer<typeof cardSchema>

export function SavedCardsContent({ savedCards }: { savedCards: CardType[] }) {
  return (
    <CardContent>
      <SavedCardsList savedCards={savedCards} />
    </CardContent>
  )
}
