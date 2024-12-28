"use client";

import type { EmailType } from "../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailActions } from "./email-actions";
import { EmailViewHeader } from "./email-view-header";
import { EmailViewContent } from "./email-view-content";
import { EmailViewFooter } from "./email-view-footer";
import { EmailMenuButton } from "../email-menu-button";

interface EmailViewProps {
  email: EmailType;
}

export function EmailView({ email }: EmailViewProps) {
  return (
    <Card className="flex-1 w-full md:w-auto">
      <CardHeader className="flex-row items-center space-x-1.5 space-y-0 border-b">
        <div className="flex items-center gap-1.5">
          <EmailMenuButton isIcon />
          <CardTitle className="line-clamp-2 break-all">
            {email.subject}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <EmailActions />
        <EmailViewHeader email={email} />
        <EmailViewContent email={email} />
        <EmailViewFooter />
      </CardContent>
    </Card>
  );
}
