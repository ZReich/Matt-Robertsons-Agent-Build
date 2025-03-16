"use client"

import * as React from "react"
import { ListFilter, MoreVertical, SquarePen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationDropdown } from "./notification-dropdown"
import { StatusDropdown } from "./status-dropdown"

export function ActionButtons() {
  const [notifications, setNotifications] =
    React.useState<string>("ALL_MESSAGES")
  const [status, setStatus] = React.useState<string>("ONLINE")

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" aria-label="New chat or group">
        <SquarePen className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Filter chat list">
        <ListFilter className="h-4 w-4" />
      </Button>

      {/* More Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <NotificationDropdown
            notifications={notifications}
            setNotifications={setNotifications}
          />
          <StatusDropdown status={status} setStatus={setStatus} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
