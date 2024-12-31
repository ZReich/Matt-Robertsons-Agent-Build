import type { EmailSidebarItems, EmailType } from "../types";

import { EmailProvider } from "../contexts/email-context";

import { EmailSidebar } from "./email-sidebar";

export function EmailWrapper({
  emailsData,
  sidebarItemsData,
  children,
}: {
  emailsData: EmailType[];
  sidebarItemsData: EmailSidebarItems;
  children: React.ReactNode;
}) {
  return (
    <EmailProvider emailsData={emailsData} sidebarItemsData={sidebarItemsData}>
      <div className="container h-full w-full flex gap-4 p-4">
        <EmailSidebar />
        {children}
      </div>
    </EmailProvider>
  );
}
