"use client";

import { Bell } from "lucide-react";

import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface NotificationDropdownProps {
  notifications: string;
  setNotifications: (val: string) => void;
}

export function NotificationDropdown({
  notifications,
  setNotifications,
}: NotificationDropdownProps) {
  const options = [
    { value: "ALL_MESSAGES", label: "All Messages" },
    { value: "ONLY_MENTIONS", label: "Only @mentions" },
    { value: "NOTHING", label: "Nothing" },
  ];

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Bell className="mr-2 h-4 w-4" />
        <span>Notifications</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={notifications}
          onValueChange={setNotifications}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
