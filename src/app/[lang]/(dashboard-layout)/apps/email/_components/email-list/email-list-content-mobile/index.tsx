import { cn } from "@/lib/utils";

import type { EmailType } from "../../../types";

import { useSettings } from "@/hooks/use-settings";

import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailListContentItemMoblie } from "./email-list-content-item-mobile";

interface EmailListContentMobileProps {
  emails: EmailType[];
  selectedEmails: string[];
  starredEmails: string[];
  toggleSelectEmail: (emailId: string) => void;
  toggleStarEmail: (emailId: string) => void;
  navigateToEmailOnKeyPress: (e: React.KeyboardEvent, emailId: string) => void;
}

export function EmailListContentMobile({
  emails,
  selectedEmails,
  starredEmails,
  toggleSelectEmail,
  toggleStarEmail,
  navigateToEmailOnKeyPress,
}: EmailListContentMobileProps) {
  const { settings } = useSettings();
  const selectedEmailsSet = new Set(selectedEmails);
  const starredEmailsSet = new Set(starredEmails);

  return (
    <ul>
      <ScrollArea
        className={cn(
          "h-[calc(100vh-19.1rem)]",
          settings.layout === "horizontal" && "md:h-[calc(100vh-22.1rem)]"
        )}
      >
        {emails.map((email) => (
          <EmailListContentItemMoblie
            key={email.id}
            email={email}
            selectedEmails={selectedEmailsSet}
            starredEmails={starredEmailsSet}
            toggleSelectEmail={toggleSelectEmail}
            toggleStarEmail={toggleStarEmail}
            navigateToEmailOnKeyPress={navigateToEmailOnKeyPress}
          />
        ))}
      </ScrollArea>
    </ul>
  );
}
