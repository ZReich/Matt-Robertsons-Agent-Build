"use client";

import * as React from "react";
import {
  useSearchParams,
  useParams,
  useRouter,
  usePathname,
} from "next/navigation";
import { useMedia } from "react-use";

import { getEmailsData } from "../../_actions/get-emails-data";

import type { EmailState } from "../../types";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EmailListHeader } from "./email-list-header";
import { EmailListContentMobile } from "./email-list-content-mobile";
import { EmailListContentDesktop } from "./email-list-content-desktop";
import { EmailListContentHeader } from "./email-list-content-header";
import { ensureSuffix } from "@/lib/utils";

const initialEmailState: EmailState = {
  emails: [],
  totalPages: 1,
  currentPage: 1,
  totalEmails: 0,
};

export function EmailList({
  emails = initialEmailState,
}: {
  emails?: EmailState;
}) {
  const [emailState, setEmailState] = React.useState(emails);
  const [selectedEmails, setSelectedEmails] = React.useState<string[]>([]);
  const [starredEmails, setStarredEmails] = React.useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");

  const pageQuery = searchParams.get("page")
    ? parseInt(searchParams.get("page") as string)
    : 1; // Get the current page from the search params, default to page 1
  const filterParam = params.filter as string;

  React.useEffect(() => {
    const fetchEmailsData = async () => {
      const emailsData = await getEmailsData(pageQuery, filterParam);
      if (emailsData) setEmailState(emailsData);
    };
    fetchEmailsData();
  }, [pageQuery, filterParam]);

  const toggleSelectEmail = (emailId: string) => {
    setSelectedEmails(
      (current) =>
        current.includes(emailId)
          ? current.filter((id) => id !== emailId) // Remove the email ID if it is already selected
          : [...current, emailId] // Add the email ID if it is not yet selected
    );
  };

  const toggleStarEmail = (emailId: string) => {
    setStarredEmails(
      (current) =>
        current.includes(emailId)
          ? current.filter((id) => id !== emailId) // Remove the email ID from starred if it is already starred
          : [...current, emailId] // Add the email ID to starred if it is not already starred
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmails.length === emailState.emails.length) {
      setSelectedEmails([]); // Deselect all if all emails are currently selected
    } else {
      setSelectedEmails(emailState.emails.map((email) => email.id)); // Select all emails if none or some are selected
    }
  };

  const navigateToEmailOnKeyPress = (
    e: React.KeyboardEvent,
    emailId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      router.push(ensureSuffix(pathname, "/") + emailId);
    }
  };

  return (
    <Card className="flex-1 w-full flex flex-col md:w-auto">
      <EmailListHeader
        pageQuery={pageQuery}
        filterParam={filterParam}
        emailState={emailState}
        setEmailState={setEmailState}
      />
      <CardContent className="p-0">
        <EmailListContentHeader
          emailState={emailState}
          selectedEmails={selectedEmails}
          toggleSelectAll={toggleSelectAll}
        />
        {isMediumOrSmaller ? (
          <EmailListContentMobile
            emails={emailState.emails}
            selectedEmails={selectedEmails}
            starredEmails={starredEmails}
            toggleSelectEmail={toggleSelectEmail}
            toggleStarEmail={toggleStarEmail}
            navigateToEmailOnKeyPress={navigateToEmailOnKeyPress}
          />
        ) : (
          <EmailListContentDesktop
            emails={emailState.emails}
            selectedEmails={selectedEmails}
            starredEmails={starredEmails}
            toggleSelectEmail={toggleSelectEmail}
            toggleStarEmail={toggleStarEmail}
            navigateToEmailOnKeyPress={navigateToEmailOnKeyPress}
          />
        )}
      </CardContent>
      <CardFooter className="justify-center py-3 border-t border-border">
        <p className="text-muted-foreground" role="status" aria-live="polite">
          {emailState.emails.length
            ? `1-${
                emailState.emails.length
              } of ${emailState.totalEmails.toLocaleString()}`
            : "No emails available"}
        </p>
      </CardFooter>
    </Card>
  );
}
