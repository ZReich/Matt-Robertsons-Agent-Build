import { EllipsisVertical } from "lucide-react";

import { customerInsightsData } from "../_data/customer-insights";

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
import { CustomerInsightList } from "./customer-insight-list";

export async function CustomerInsights() {
  return (
    <article className="col-span-full">
      <Card>
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle>Customer Insights</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <CustomerInsightList data={customerInsightsData} />
        </CardContent>
      </Card>
    </article>
  );
}
