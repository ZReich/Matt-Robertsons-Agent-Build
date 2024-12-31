import { useRouter, usePathname } from "next/navigation";
import { Star, EllipsisVertical } from "lucide-react";

import { cn, ensureSuffix, formatDate } from "@/lib/utils";

import type { EmailType } from "../../../../types";

import { useEmailContext } from "../../../../hooks/use-email-context";

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
  isSelected: boolean;
}

export function EmailListContentItemMoblie({
  email,
  isSelected,
}: EmailListContentItemMoblieProps) {
  const { handleToggleSelectEmail, handleToggleStarEmail, handleSetRead } =
    useEmailContext();
  const router = useRouter();
  const pathname = usePathname();

  const isStarred = email.starred;

  function handleOnKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      handleSetRead(email);
      router.push(ensureSuffix(pathname, "/") + email.id);
    }
  }

  function handleOnClick() {
    handleSetRead(email);
    router.push(ensureSuffix(pathname, "/") + email.id);
  }

  return (
    <li
      key={email.id}
      className={cn(
        "flex items-center justify-between gap-1.5 p-1 ps-3 cursor-pointer",
        email.read && "bg-muted"
      )}
      onClick={handleOnClick}
      onKeyDown={handleOnKeyDown}
      tabIndex={0}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => handleToggleSelectEmail(email)}
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
          handleToggleStarEmail(email);
        }}
        aria-label={isStarred ? `Unstar email` : `Star email`}
        aria-live="polite"
      >
        <Star
          className={`h-4 w-4 ${
            isStarred
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
