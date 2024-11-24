import { EllipsisVertical } from "lucide-react";

import { salesRepresentativeData } from "../../_data/top-sales-representatives";

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
import { TopSalesRepresentativesList } from "./top-sales-representatives-list";

export function TopSalesRepresentatives() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Top Sales Representatives</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <TopSalesRepresentativesList data={salesRepresentativeData} />
        </CardContent>
      </Card>
    </article>
  );
}
