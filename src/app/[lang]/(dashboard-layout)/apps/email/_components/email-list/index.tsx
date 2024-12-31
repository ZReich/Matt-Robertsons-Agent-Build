"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { EmailListHeader } from "./email-list-header";
import { EmailListContent } from "./email-list-content";
import { EmailListFooter } from "./email-list-footer";

export function EmailList() {
  return (
    <Card className="flex-1 w-full flex flex-col md:w-auto">
      <EmailListHeader />
      <EmailListContent />
      <EmailListFooter />
    </Card>
  );
}
