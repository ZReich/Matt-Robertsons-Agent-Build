"use client";

import * as React from "react";
import {
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
} from "next/navigation";
import { useMedia } from "react-use";
import {
  Star,
  RotateCw,
  EllipsisVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { getEmailsData } from "../_actions/get-emails-data";

import { cn, ensureSuffix, formatDate, getInitials } from "@/lib/utils";

import type { EmailState } from "../types";

import { useSettings } from "@/hooks/use-settings";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { EmailListSearchForm } from "./email-list-search-form";

const initialState: EmailState = {
  emails: [],
  totalPages: 1,
  currentPage: 1,
  totalEmails: 0,
};

export function EmailList({ emails = initialState }: { emails?: EmailState }) {
  const [emailState, setEmailState] = React.useState(emails);
  const [selectedEmails, setSelectedEmails] = React.useState<string[]>([]);
  const [starredEmails, setStarredEmails] = React.useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");
  const { settings } = useSettings();

  const pageQuery = searchParams.get("page")
    ? parseInt(searchParams.get("page") as string)
    : 1; // Get the current page from the search params, default to page 1
  const filterParam = params.filter as string;
  const layout = settings.layout;

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
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-1 ps-3 border-b border-border md:p-2 md:ps-4">
          <Checkbox
            checked={selectedEmails.length === emailState.emails.length}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all emails"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                aria-label="Email actions"
                disabled={!selectedEmails.length}
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Archive</DropdownMenuItem>
              <DropdownMenuItem>Mark as spam</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Render the list of emails in a mobile-friendly layout if needed */}
        {isMediumOrSmaller ? (
          <ul>
            <ScrollArea className="h-[calc(100vh-19.1rem)]">
              {emailState.emails.map((email) => (
                <li
                  key={email.id}
                  className={cn(
                    "flex items-center justify-between gap-1.5 p-1 ps-3 cursor-pointer",
                    email.read && "bg-muted"
                  )}
                  onClick={() =>
                    router.push(ensureSuffix(pathname, "/") + email.id)
                  }
                  tabIndex={0}
                  onKeyDown={(e) => navigateToEmailOnKeyPress(e, email.id)}
                >
                  <Checkbox
                    checked={selectedEmails.includes(email.id)}
                    onCheckedChange={() => toggleSelectEmail(email.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select email"
                  />

                  <div className="flex-1 px-2">
                    <span className="font-bold line-clamp-1 break-all">
                      {email.subject}
                    </span>
                    <span className="text-muted-foreground line-clamp-1 break-all">
                      From {email.sender.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(email.createdAt)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStarEmail(email.id);
                    }}
                    aria-label={
                      starredEmails.includes(email.id)
                        ? `Unstar email`
                        : `Star email`
                    }
                    aria-live="polite"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        email.starred
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="More actions"
                      >
                        <EllipsisVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Archive</DropdownMenuItem>
                      <DropdownMenuItem>Mark as spam</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ScrollArea>
          </ul>
        ) : (
          // Render the email list in a table format for larger screens
          <ScrollArea
            className={cn(
              "h-[calc(100vh-19.1rem)]",
              layout === "horizontal" && "md:h-[calc(100vh-22.1rem)]"
            )}
          >
            <Table>
              <TableBody>
                {emailState.emails.map((email) => (
                  <TableRow
                    key={email.id}
                    className={cn("cursor-pointer", email.read && "bg-muted")}
                    onClick={() =>
                      router.push(ensureSuffix(pathname, "/") + email.id)
                    }
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        router.push(ensureSuffix(pathname, "/") + email.id);
                      }
                    }}
                  >
                    <TableCell className="w-10 text-center">
                      <Checkbox
                        checked={selectedEmails.includes(email.id)}
                        onCheckedChange={() => toggleSelectEmail(email.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select email"
                      />
                    </TableCell>
                    <TableCell className="w-10 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStarEmail(email.id);
                        }}
                        aria-label={
                          starredEmails.includes(email.id)
                            ? " email email"
                            : "Star email"
                        }
                        aria-live="polite"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            email.starred
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="w-44">
                      <div className="flex items-center gap-2">
                        <Avatar>
                          <AvatarImage
                            src={email.sender?.avatar}
                            alt="Avatar"
                          />
                          <AvatarFallback>
                            {getInitials(email.sender.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold line-clamp-1 break-all">
                          {email.sender.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground line-clamp-1 break-all">
                        {email.subject}
                      </span>
                    </TableCell>
                    <TableCell className="w-28">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(email.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="w-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="More actions"
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Archive</DropdownMenuItem>
                          <DropdownMenuItem>Mark as spam</DropdownMenuItem>
                          <DropdownMenuItem>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
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
