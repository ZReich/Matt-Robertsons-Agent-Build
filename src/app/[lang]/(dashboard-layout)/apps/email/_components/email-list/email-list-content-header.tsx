"use client";

import * as React from "react";
import { EllipsisVertical } from "lucide-react";

import type { EmailState } from "../../types";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EmailListContentHeaderProps {
  emailState: EmailState;
  selectedEmails: string[];
  toggleSelectAll: () => void;
}

export function EmailListContentHeader({
  emailState,
  selectedEmails,
  toggleSelectAll,
}: EmailListContentHeaderProps) {
  return (
    <div className="flex items-center justify-between p-1 ps-3 border-b border-border md:p-2 md:ps-4">
      <Checkbox
        checked={selectedEmails.length === emailState.emails.length}
        onCheckedChange={toggleSelectAll}
        aria-label="Select all emails"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            aria-label="Email actions"
            disabled={!selectedEmails.length}
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Archive</DropdownMenuItem>
          <DropdownMenuItem>Mark as spam</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
