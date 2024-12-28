import { emailsData } from "../_data/emails";
import { sidebarLabelsData } from "../_data/emails-sidebar-labels";

import { EmailProvider } from "../contexts/email-context";

import { EmailSidebar } from "./email-sidebar";

export function EmailWrapper({ children }: { children: React.ReactNode }) {
  return (
    <EmailProvider emailsData={emailsData}>
      <div className="container h-full w-full flex gap-4 p-4">
        <EmailSidebar data={sidebarLabelsData} />
        {children}
      </div>
    </EmailProvider>
  );
}
