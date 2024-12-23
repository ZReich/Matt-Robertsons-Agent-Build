import { useRouter, usePathname } from "next/navigation";
import { Star, EllipsisVertical } from "lucide-react";

import { cn, ensureSuffix, formatDate } from "@/lib/utils";

import type { EmailType } from "../../../types";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface EmailListContentItemMoblieProps {
  email: EmailType;
  selectedEmails: Set<string>;
  starredEmails: Set<string>;
  toggleSelectEmail: (emailId: string) => void;
  toggleStarEmail: (emailId: string) => void;
  navigateToEmailOnKeyPress: (e: React.KeyboardEvent, emailId: string) => void;
}

export function EmailListContentItemMoblie({
  email,
  selectedEmails,
  starredEmails,
  toggleSelectEmail,
  toggleStarEmail,
  navigateToEmailOnKeyPress,
}: EmailListContentItemMoblieProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isStarted = starredEmails.has(email.id);
  const isSelected = selectedEmails.has(email.id);

  return (
    <li
      key={email.id}
      className={cn(
        "flex items-center justify-between gap-1.5 p-1 ps-3 cursor-pointer",
        email.read && "bg-muted"
      )}
      onClick={() => router.push(ensureSuffix(pathname, "/") + email.id)}
      onKeyDown={(e) => navigateToEmailOnKeyPress(e, email.id)}
      tabIndex={0}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => toggleSelectEmail(email.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select email"
      />

      <div className="flex-1 px-2">
        <span className="font-bold line-clamp-1 break-all">
          {email.subject}
        </span>
        <span className="text-muted-foreground line-clamp-1 break-all">
          From {email.sender.name}
        </span>
        <span className="text-sm text-muted-foreground">
          {formatDate(email.createdAt)}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4"
        onClick={(e) => {
          e.stopPropagation();
          toggleStarEmail(email.id);
        }}
        aria-label={isStarted ? `Unstar email` : `Star email`}
        aria-live="polite"
      >
        <Star
          className={`h-4 w-4 ${
            isStarted
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
          }`}
        />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            aria-label="More actions"
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
    </li>
  );
}
