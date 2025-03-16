"use client"

import { Card } from "@/components/ui/card"
import { EmailComposerContent } from "./email-composer-content"
import { EmailComposerHeader } from "./email-composer-header"

export function EmailComposer() {
  return (
    <Card className="flex-1 w-full flex flex-col md:w-auto">
      <EmailComposerHeader />
      <EmailComposerContent />
    </Card>
  )
}
