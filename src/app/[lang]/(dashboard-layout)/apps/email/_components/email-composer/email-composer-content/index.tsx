"use client";

import { CardContent } from "@/components/ui/card";
import { EmailComposerForm } from "./email-composer-form";

export function EmailComposerContent() {
  return (
    <CardContent className="flex-1 h-full p-0">
      <EmailComposerForm />
    </CardContent>
  );
}
