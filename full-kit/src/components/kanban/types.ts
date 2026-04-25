export type KanbanCardBase<TKey extends string = string> = {
  id: string
  columnId: TKey
}

export type KanbanColumnData<TKey extends string, TCard> = {
  id: TKey
  title: string
  cards: TCard[]
  aggregate: { count: number } & Record<string, number | undefined>
}

export type KanbanMove<TKey extends string> = {
  cardId: string
  fromColumnId: TKey
  toColumnId: TKey
  fromIndex: number
  toIndex: number
}
