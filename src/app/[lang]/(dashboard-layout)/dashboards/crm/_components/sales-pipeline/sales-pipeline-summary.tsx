"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SalesPipelineType } from "../../types";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SalesPipelineSummary({
  data,
}: {
  data: SalesPipelineType["summary"];
}) {
  return (
    <div className="flex justify-evenly items-center gap-x-6">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="grid grid-cols-2 gap-1.5">
            <Badge className="flex-col shadow-none" aria-hidden>
              <p className="text-lg text-center">{value.toLocaleString()}</p>
            </Badge>
            <h4 className="text-xs">
              Total
              <br />
              {key.slice(5)}
            </h4>
          </div>
        ))}
      </div>
      <Separator orientation="vertical" className="h-20" />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants(),
            "w-fit [&[data-state=open]>svg]:rotate-180"
          )}
        >
          <span>2024</span>
          <ChevronDown className="h-4 w-4 shrink-0 ms-2 transition-transform duration-200" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-fit">
          <DropdownMenuRadioGroup value="2024">
            <DropdownMenuRadioItem value="2024">2024</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2023">2023</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2022">2022</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
