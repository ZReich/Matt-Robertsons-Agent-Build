import Link from "next/link"

import type { ToolAndTechnologieType } from "../types"

import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/button"

export function ToolsAndTechnologiesItem({
  item,
}: {
  item: ToolAndTechnologieType
}) {
  return (
    <article key={item.title}>
      <Link
        href={item.href}
        className="size-fit flex flex-col justify-center items-center gap-2"
      >
        <div
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-20 w-20 bg-card"
          )}
        >
          <item.icon className="h-8 w-8" />
        </div>

        <h3 className="font-semibold">{item.title}</h3>
      </Link>
    </article>
  )
}
