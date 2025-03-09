import Link from "next/link"

import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"

export function RecentLogsFooter() {
  return (
    <CardFooter className="justify-center">
      <Link href="/" className={cn(buttonVariants({ variant: "link" }))}>
        View all connections
      </Link>
    </CardFooter>
  )
}
