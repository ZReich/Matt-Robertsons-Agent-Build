"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailMenuButton } from "../email-menu-button";
import { EmailComposerForm } from "./email-composer-form";

export function EmailComposer() {
  return (
    <Card className="flex-1 w-full md:w-auto">
      <CardHeader className="flex-row items-center space-x-1.5 space-y-0">
        <EmailMenuButton isIcon />
        <CardTitle>Compose Mail</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <EmailComposerForm />
      </CardContent>
    </Card>
  );
}
