import type { EmailType } from "../../../types";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody } from "@/components/ui/table";
import { EmailListContentRowDesktop } from "./email-list-row-desktop";

interface EmailListContentDesktopProps {
  emails: EmailType[];
  selectedEmails: string[];
  starredEmails: string[];
  toggleSelectEmail: (emailId: string) => void;
  toggleStarEmail: (emailId: string) => void;
  navigateToEmailOnKeyPress: (e: React.KeyboardEvent, emailId: string) => void;
}

export function EmailListContentDesktop({
  emails,
  selectedEmails,
  starredEmails,
  toggleSelectEmail,
  toggleStarEmail,
  navigateToEmailOnKeyPress,
}: EmailListContentDesktopProps) {
  const selectedEmailsSet = new Set(selectedEmails);
  const starredEmailsSet = new Set(starredEmails);

  return (
    <ScrollArea className="h-[calc(100vh-19.1rem)]">
      <Table>
        <TableBody>
          {emails.map((email) => (
            <EmailListContentRowDesktop
              key={email.id}
              email={email}
              selectedEmails={selectedEmailsSet}
              starredEmails={starredEmailsSet}
              toggleSelectEmail={toggleSelectEmail}
              toggleStarEmail={toggleStarEmail}
              navigateToEmailOnKeyPress={navigateToEmailOnKeyPress}
            />
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
