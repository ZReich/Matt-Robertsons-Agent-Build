import { EllipsisVertical } from "lucide-react";

import { trafficSourcesData } from "../_data/traffic-sources";

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
import { TrafficSourcesChart } from "./charts/traffic-sources-chart";

export async function TrafficSources() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start pb-0">
          <div>
            <CardTitle>Traffic Sources</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <TrafficSourcesChart data={trafficSourcesData} />
        </CardContent>
      </Card>
    </article>
  );
}
