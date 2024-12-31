import {
  useRouter,
  usePathname,
  useParams,
  useSearchParams,
} from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { useEmailContext } from "../../hooks/use-email-context";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { CardHeader } from "@/components/ui/card";
import { EmailListSearchForm } from "./email-list-search-form";
import { EmailMenuButton } from "../email-menu-button";

export function EmailListHeader() {
  const { emailState } = useEmailContext();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();

  const pageQuery = searchParams.get("page")
    ? parseInt(searchParams.get("page") as string)
    : 1; // Get the current page from the search params, default to page 1
  const filterParam = params.segment as string;

  return (
    <CardHeader className="flex-row items-center space-x-1.5 space-y-0 pb-0">
      <EmailMenuButton isIcon />
      <EmailListSearchForm pageQuery={pageQuery} filterParam={filterParam} />
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
