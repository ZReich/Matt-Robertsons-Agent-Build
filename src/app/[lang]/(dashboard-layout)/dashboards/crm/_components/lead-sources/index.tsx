import { EllipsisVertical } from "lucide-react";
import { leadSourcesData } from "../../_data/lead-sources";

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
import { LeadSourcesChart } from "./lead-sources-chart";

export function LeadSources() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <LeadSourcesChart data={leadSourcesData} />
        </CardContent>
      </Card>
    </article>
  );
}
