import Link from "next/link";

import { cn } from "@/lib/utils";

import { CardFooter } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function RecentLogsFooter() {
  return (
    <CardFooter className="justify-center">
      <Link href="/" className={cn(buttonVariants({ variant: "link" }))}>
        View all connections
      </Link>
    </CardFooter>
  );
}
