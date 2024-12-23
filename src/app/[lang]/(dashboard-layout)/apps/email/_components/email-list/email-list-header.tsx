import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import type { EmailState, EmailType } from "../../types";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { CardHeader } from "@/components/ui/card";
import { EmailListSearchForm } from "./email-list-search-form";

interface EmailListHeaderProps {
  pageQuery: number;
  filterParam: string;
  emailState: EmailState;
  setEmailState: (val: EmailState) => void;
}

export function EmailListHeader({
  pageQuery,
  filterParam,
  emailState,
  setEmailState,
}: EmailListHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <CardHeader className="flex-row items-center gap-1.5 pb-0">
      <EmailListSearchForm
        pageQuery={pageQuery}
        filterParam={filterParam}
        setEmailState={setEmailState}
      />
      <Button
        variant="ghost"
        size="icon"
        className="ms-auto"
        onClick={() => router.refresh()}
        aria-label="Refresh emails"
      >
        <RotateCw className="h-4 w-4" />
      </Button>
      <Pagination className="w-fit mx-0">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                router.push(`${pathname}?page=${pageQuery - 1}`);
              }}
              aria-label="Go to previous page"
              disabled={pageQuery <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                router.push(`${pathname}?page=${pageQuery + 1}`);
              }}
              aria-label="Go to next page"
              disabled={pageQuery >= emailState.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </CardHeader>
  );
}
