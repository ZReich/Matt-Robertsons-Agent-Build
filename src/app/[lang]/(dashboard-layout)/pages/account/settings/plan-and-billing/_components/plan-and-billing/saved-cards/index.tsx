import { savedCardsData } from "../../../../../_data/saved-cards";

import { Card } from "@/components/ui/card";
import { SavedCardsHeader } from "./saved-cards-header";
import { SavedCardsContent } from "./saved-cards-content";

export function SavedCards() {
  return (
    <Card>
      <SavedCardsHeader />
      <SavedCardsContent savedCards={savedCardsData} />
    </Card>
  );
}
