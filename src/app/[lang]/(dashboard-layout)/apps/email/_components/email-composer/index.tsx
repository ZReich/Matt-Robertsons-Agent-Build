"use client";

import { Card } from "@/components/ui/card";
import { EmailComposerHeader } from "./email-composer-header";
import { EmailComposerContent } from "./email-composer-content";

export function EmailComposer() {
  return (
    <Card className="flex-1 w-full md:w-auto">
      <EmailComposerHeader />
      <EmailComposerContent />
    </Card>
  );
}
