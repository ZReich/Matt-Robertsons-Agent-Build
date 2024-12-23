"use client";

import { formatDate, getInitials } from "@/lib/utils";

import type { EmailType } from "../../types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmailViewHeader({ email }: { email: EmailType }) {
  return (
    <Card className="py-1">
      <CardHeader className="flex-row items-center gap-2 py-3">
        <Avatar>
          <AvatarImage src={email.sender?.avatar} alt={email.sender.name} />
          <AvatarFallback>{getInitials(email.sender.name)}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{email.sender.name}</CardTitle>
          <CardDescription>{email.sender.email}</CardDescription>
        </div>
        <CardDescription className="ms-auto">
          {formatDate(email.createdAt)}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
