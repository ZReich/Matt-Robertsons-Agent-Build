import { EllipsisVertical } from "lucide-react";

import { topProductsData } from "../../_data/top-products";

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
import { TopProductsCarousel } from "./top-products-carousel";

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
            <DropdownMenuTrigger aria-label="More actions">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <TopProductsCarousel data={topProductsData} />
        </CardContent>
      </Card>
    </article>
  );
}
