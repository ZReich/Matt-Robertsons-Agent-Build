"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ChevronLeft,
  Clock,
  Forward,
  MoreVertical,
  Reply,
  Star,
  Tag,
  Trash2,
} from "lucide-react";

import { cn, formatDate } from "@/lib/utils";

import type { EmailType } from "../types";

import { useSettings } from "@/hooks/use-settings";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

export function EmailView({ email }: { email: EmailType }) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSettings();

  const layout = settings.layout;

  return (
    <Card className="flex-1 w-full md:w-auto">
      <CardHeader className="border-b py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(pathname.replace(email.id, ""))}
            aria-label="Go back to email list"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="line-clamp-2 break-all">
            {email.subject}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" aria-label="Delete email">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Archive email">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Snooze email">
              <Clock className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Label email">
              <Tag className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Star email">
              <Star className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                <DropdownMenuItem>Star thread</DropdownMenuItem>
                <DropdownMenuItem>Add label</DropdownMenuItem>
                <DropdownMenuItem>Mute thread</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Card className="py-1">
          <ScrollArea
            className={cn(
              "h-[calc(100vh-20.7rem)]",
              layout === "horizontal" && "md:h-[calc(100vh-24.3rem)]"
            )}
          >
            <CardHeader className="flex-row items-center gap-2 py-3">
              <Avatar>
                <AvatarImage src="" alt="Avatar" />
                <AvatarFallback>SA</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{email.sender.name}</CardTitle>
                <CardDescription>{email.sender.email}</CardDescription>
              </div>
              <CardDescription className="ms-auto">
                {formatDate(email.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap">
              {email.content}
            </CardContent>
          </ScrollArea>
        </Card>
        <CardFooter className="p-3 pt-0 gap-1.5">
          <Button variant="outline">
            <Reply className="me-2 h-4 w-4" />
            <span>Reply</span>
          </Button>
          <Button variant="outline">
            <Forward className="me-2 h-4 w-4" />
            <span>Forward</span>
          </Button>
        </CardFooter>
      </CardContent>
    </Card>
  );
}
