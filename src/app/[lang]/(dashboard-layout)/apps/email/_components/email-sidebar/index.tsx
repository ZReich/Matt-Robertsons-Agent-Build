"use client";

import { useMedia } from "react-use";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";

import type { EmailSidebarLabel } from "../../types";

import { useEmailContext } from "../../hooks/use-email-context";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmailSidebarHeader } from "./email-sidebar-header";
import { EmailSidebarList } from "./email-sidebar-list";

export function EmailSidebar({ data }: { data: EmailSidebarLabel[] }) {
  const { isEmailSidebarOpen, setIsEmailSidebarOpen } = useEmailContext();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");

  // Content to display in the chat sidebar
  const content = (
    <>
      <EmailSidebarHeader />
      <EmailSidebarList data={data} />
    </>
  );

  // Render a persistent sidebar for larger screens
  if (!isMediumOrSmaller) {
    return (
      <aside>
        <Card className="h-full w-72 border border-border">{content}</Card>
      </aside>
    );
  }

  // Render a sheet sidebar for smaller screens
  return (
    <Sheet open={isEmailSidebarOpen} onOpenChange={setIsEmailSidebarOpen}>
      <SheetContent side="start">
        <SheetHeader className="sr-only">
          <SheetTitle>Email Sidebar</SheetTitle>
          <SheetDescription>
            Navigate your emails with ease. Access your inbox, sent items, and
            custom labels.
          </SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
