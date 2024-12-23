"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import type { EmailType } from "../../types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailActions } from "./email-actions";
import { EmailViewHeader } from "./email-view-header";
import { EmailViewContent } from "./email-view-content";
import { EmailViewFooter } from "./email-view-footer";

interface EmailViewProps {
  email: EmailType;
}

export function EmailView({ email }: EmailViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleGoBack() {
    router.push(pathname.replace(email.id, ""));
  }

  return (
    <Card className="flex-1 w-full md:w-auto">
      <CardHeader className="border-b py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoBack}
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
        <EmailActions />
        <EmailViewHeader email={email} />
        <EmailViewContent email={email} />
        <EmailViewFooter />
      </CardContent>
    </Card>
  );
}
