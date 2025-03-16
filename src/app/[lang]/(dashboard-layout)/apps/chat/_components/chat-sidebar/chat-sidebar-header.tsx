"use client"

import { CardHeader } from "@/components/ui/card"
import { ActionButtons } from "./action-buttons"
import { SearchInput } from "./search-input"

export function ChatSidebarHeader() {
  return (
    <CardHeader className="flex flex-row items-center space-y-0 gap-x-1.5 p-3 border-b border-border">
      <div className="grow flex justify-between items-center gap-2">
        <SearchInput />
        <ActionButtons />
      </div>
    </CardHeader>
  )
}
