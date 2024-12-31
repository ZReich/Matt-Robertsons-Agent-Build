"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { EmailMenuButton } from "../email-menu-button";

export function EmailComposerHeader() {
  return (
    <CardHeader className="flex-row items-center space-x-1.5 space-y-0">
      <EmailMenuButton isIcon />
      <CardTitle>Compose Mail</CardTitle>
    </CardHeader>
  );
}
