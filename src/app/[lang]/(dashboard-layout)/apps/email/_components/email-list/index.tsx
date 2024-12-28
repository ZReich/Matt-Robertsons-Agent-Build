"use client";

import * as React from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useMedia } from "react-use";

import { useEmailContext } from "../../hooks/use-email-context";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EmailListHeader } from "./email-list-header";
import { EmailListContentMobile } from "./email-list-content-mobile";
import { EmailListContentDesktop } from "./email-list-content-desktop";
import { EmailListContentHeader } from "./email-list-content-header";

export function EmailList() {
  const { emailState, handleGetFilteredEmails } = useEmailContext();
  const params = useParams();
  const searchParams = useSearchParams();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");

  const pageQuery = searchParams.get("page")
    ? parseInt(searchParams.get("page") as string)
    : 1; // Get the current page from the search params, default to page 1
  const filterParam = params.segment as string;

  React.useEffect(() => {
    handleGetFilteredEmails(filterParam, pageQuery);
  }, [pageQuery, filterParam, handleGetFilteredEmails]);

  return (
    <Card className="flex-1 w-full flex flex-col md:w-auto">
      <EmailListHeader pageQuery={pageQuery} filterParam={filterParam} />
      <CardContent className="p-0">
        <EmailListContentHeader />
        {isMediumOrSmaller ? (
          <EmailListContentMobile />
        ) : (
          <EmailListContentDesktop />
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
