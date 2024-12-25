import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RecentLogsTable } from "./recent-logs-table";

export function RecentLogs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Logs</CardTitle>
        <CardDescription>
          View recent activity on your account. Check for any unusual or
          suspicious actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RecentLogsTable />
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/" className={cn(buttonVariants({ variant: "link" }))}>
          View all connections
        </Link>
      </CardFooter>
    </Card>
  );
}
