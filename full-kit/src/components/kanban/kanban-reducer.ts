import type { KanbanColumnData, KanbanMove } from "./types"

export function moveKanbanCard<
  TKey extends string,
  TCard extends { id: string },
>(
  columns: KanbanColumnData<TKey, TCard>[],
  move: KanbanMove<TKey>
): KanbanColumnData<TKey, TCard>[] {
  const next = columns.map((column) => ({
    ...column,
    cards: [...column.cards],
  }))
  const source = next.find((column) => column.id === move.fromColumnId)
  const destination = next.find((column) => column.id === move.toColumnId)
  if (!source || !destination) return columns

  const [card] = source.cards.splice(move.fromIndex, 1)
  if (!card) return columns
  destination.cards.splice(move.toIndex, 0, card)
  return next
}
