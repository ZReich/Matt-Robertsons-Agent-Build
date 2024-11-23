import { EllipsisVertical } from "lucide-react";

import { topProductsData } from "../_data/top-products";

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
import { TopProductsTable } from "./tables/top-products-table";

export async function TopProducts() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="pt-8 pb-[4.5rem]">
          <TopProductsTable data={topProductsData} />
        </CardContent>
      </Card>
    </article>
  );
}
