"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Clock,
  Forward,
  MoreVertical,
  Reply,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface EmailViewProps {
  emailId: string;
}

export function EmailView({ emailId }: EmailViewProps) {
  const router = useRouter();
  // In a real app, you'd fetch the email data based on the emailId
  const emailData = {
    subject: "Refer friends. Get rewards.",
    sender: "Waldemar Mannering",
    senderEmail: "wmannering@mozilla.org",
    date: "Dec 15, 2018, 02:02 PM",
    content: `Hi John,

At Auto Sales, we understand that our customers are our greatest resource, and the only real way that an automotive dealership can grow is through word of mouth.

If you had a wonderful experience with us, the greatest thanks you can give is to pass along your praise and positive experience with Auto Sales to your family, friends, and colleagues.

As a reward for promoting us, we will pay you $200 for every referral you send our way who purchases a pre-owned vehicle of under $15,000. For every purchase over $15,000, we will pay you a referral of $300.

Regards

Waldemar Mannering`,
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{emailData.subject}</span>
            <Badge
              variant="secondary"
              className="bg-red-100 text-red-800 hover:bg-red-100"
            >
              Private
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Archive className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Clock className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Star className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
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
          <Card className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <img
                    alt="Sender avatar"
                    src="/placeholder.svg?height=40&width=40"
                    className="rounded-full"
                  />
                </Avatar>
                <div>
                  <div className="font-semibold">{emailData.sender}</div>
                  <div className="text-sm text-muted-foreground">
                    {emailData.senderEmail}
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {emailData.date}
              </div>
            </div>
            <div className="space-y-4 text-sm whitespace-pre-wrap">
              {emailData.content}
            </div>
          </Card>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="gap-2">
              <Reply className="h-4 w-4" />
              Reply
            </Button>
            <Button variant="outline" className="gap-2">
              <Forward className="h-4 w-4" />
              Forward
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
