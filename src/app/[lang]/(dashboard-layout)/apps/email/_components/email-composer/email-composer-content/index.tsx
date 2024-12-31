"use client";

import { CardContent } from "@/components/ui/card";
import { EmailComposerForm } from "./email-composer-form";

export function EmailComposerContent() {
  return (
    <CardContent className="p-0">
      <EmailComposerForm />
    </CardContent>
  );
}
