import { EllipsisVertical } from "lucide-react";

import { customerSatisfactionData } from "../../_data/customer-satisfaction";

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
import { CustomerSatisfactionChart } from "./customer-satisfaction-cart";
import { CustomerSatisfactionCarousel } from "./customer-satisfaction-carousel";

export function CustomerSatisfaction() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Customer Satisfaction</CardTitle>
            <CardDescription>Last week</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center gap-6 md:flex-row">
          <CustomerSatisfactionChart data={customerSatisfactionData.summary} />
          <CustomerSatisfactionCarousel
            data={customerSatisfactionData.feedbacks}
          />
        </CardContent>
      </Card>
    </article>
  );
}
