"use client";

import * as React from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useMedia } from "react-use";

import { useEmailContext } from "../../../hooks/use-email-context";

import { CardContent } from "@/components/ui/card";
import { EmailListContentMobile } from "./email-list-content-mobile";
import { EmailListContentDesktop } from "./email-list-content-desktop";
import { EmailListContentHeader } from "./email-list-content-header";

export function EmailListContent() {
  const { handleGetFilteredEmails } = useEmailContext();
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
    <CardContent className="p-0">
      <EmailListContentHeader />
      {isMediumOrSmaller ? (
        <EmailListContentMobile />
      ) : (
        <EmailListContentDesktop />
      )}
    </CardContent>
  );
}
