import { EllipsisVertical } from "lucide-react";

import { conversionFunnelData } from "../../_data/conversion-funnel";

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
import { ConversionFunnelChart } from "./conversion-funnel-chart";

export async function ConversionFunnel() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <ConversionFunnelChart data={conversionFunnelData} />
        </CardContent>
      </Card>
    </article>
  );
}
