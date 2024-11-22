import { EllipsisVertical } from "lucide-react";

import { salesByCountryData } from "../../_data/sales-by-country";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SalesByCountryTable } from "./sales-by-country.table";

export function SalesByCountry() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Sales By Country</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <ScrollArea
            orientation="horizontal"
            className="w-[calc(100vw-5rem)] md:w-auto"
          >
            <SalesByCountryTable data={salesByCountryData} />
          </ScrollArea>
        </CardContent>
      </Card>
    </article>
  );
}
