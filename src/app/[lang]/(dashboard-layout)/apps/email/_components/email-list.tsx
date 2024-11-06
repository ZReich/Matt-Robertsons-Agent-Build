"use client";

import * as React from "react";
import { Search, Star, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, ensureSuffix } from "@/lib/utils";
import { Email } from "../types";
import Link from "next/link";
import { getLocalizedPathname } from "@/lib/i18n";
import { useParams, usePathname } from "next/navigation";
import { Locale } from "@/configs/i18n";

export function EmailList({ emails }: { emails: Email[] }) {
  const [selectedEmails, setSelectedEmails] = React.useState<string[]>([]);
  const [starredEmails, setStarredEmails] = React.useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = React.useState<string | null>(null);
  const pathname = usePathname();

  const toggleSelectEmail = (emailId: string) => {
    setSelectedEmails((current) =>
      current.includes(emailId)
        ? current.filter((id) => id !== emailId)
        : [...current, emailId]
    );
  };

  const toggleStarEmail = (emailId: string) => {
    setStarredEmails((current) =>
      current.includes(emailId)
        ? current.filter((id) => id !== emailId)
        : [...current, emailId]
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b p-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search mail" className="pl-8" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {emails.map((email) => (
          <Link
            key={email.id}
            href={ensureSuffix(pathname, "/") + email.id}
            className={cn(
              "flex items-center gap-2 border-b p-4 hover:bg-muted/50 cursor-pointer",
              !email.read && "bg-muted/30"
            )}
          >
            <Checkbox
              checked={selectedEmails.includes(email.id)}
              onCheckedChange={() => toggleSelectEmail(email.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={(e) => {
                e.stopPropagation();
                toggleStarEmail(email.id);
              }}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  starredEmails.includes(email.id)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                )}
              />
            </Button>
            <img src={email.avatar} alt="" className="h-8 w-8 rounded-full" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{email.name}</span>
                <span className="text-muted-foreground text-sm">
                  {email.subject}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {email.timestamp}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Archive</DropdownMenuItem>
                  <DropdownMenuItem>Mark as spam</DropdownMenuItem>
                  <DropdownMenuItem>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Link>
        ))}
      </ScrollArea>
    </div>
  );
}
