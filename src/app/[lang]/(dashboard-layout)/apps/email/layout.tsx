import { emailsData } from "./_data/emails";
import { sidebarItemsData } from "./_data/emails-sidebar-items";

import { EmailWrapper } from "./_components/email-wrapper";

export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EmailWrapper emailsData={emailsData} sidebarItemsData={sidebarItemsData}>
      {children}
    </EmailWrapper>
  );
}
