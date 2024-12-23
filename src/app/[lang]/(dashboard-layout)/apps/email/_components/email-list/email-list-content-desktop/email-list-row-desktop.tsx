import { useRouter, usePathname } from "next/navigation";
import { Star, EllipsisVertical } from "lucide-react";

import { cn, ensureSuffix, formatDate, getInitials } from "@/lib/utils";

import type { EmailType } from "../../../types";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TableRow, TableCell } from "@/components/ui/table";

interface EmailListContentRowDesktopProps {
  email: EmailType;
  selectedEmails: Set<string>;
  starredEmails: Set<string>;
  toggleSelectEmail: (emailId: string) => void;
  toggleStarEmail: (emailId: string) => void;
  navigateToEmailOnKeyPress: (e: React.KeyboardEvent, emailId: string) => void;
}

export function EmailListContentRowDesktop({
  email,
  selectedEmails,
  starredEmails,
  toggleSelectEmail,
  toggleStarEmail,
  navigateToEmailOnKeyPress,
}: EmailListContentRowDesktopProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isStarted = starredEmails.has(email.id);
  const isSelected = selectedEmails.has(email.id);

  return (
    <TableRow
      key={email.id}
      className={cn("cursor-pointer", email.read && "bg-muted")}
      onClick={() => router.push(ensureSuffix(pathname, "/") + email.id)}
      tabIndex={0}
      onKeyDown={(e) => navigateToEmailOnKeyPress(e, email.id)}
    >
      <TableCell className="w-10 text-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelectEmail(email.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select email"
        />
      </TableCell>
      <TableCell className="w-10 text-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4"
          onClick={(e) => {
            e.stopPropagation();
            toggleStarEmail(email.id);
          }}
          aria-label={isStarted ? " email email" : "Star email"}
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
      </TableCell>
      <TableCell className="w-44">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src={email.sender?.avatar} alt="Avatar" />
            <AvatarFallback>{getInitials(email.sender.name)}</AvatarFallback>
          </Avatar>
          <span className="font-bold line-clamp-1 break-all">
            {email.sender.name}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground line-clamp-1 break-all">
          {email.subject}
        </span>
      </TableCell>
      <TableCell className="w-28">
        <span className="text-sm text-muted-foreground">
          {formatDate(email.createdAt)}
        </span>
      </TableCell>
      <TableCell className="w-10">
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
      </TableCell>
    </TableRow>
  );
}
