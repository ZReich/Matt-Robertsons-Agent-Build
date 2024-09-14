import { z } from "zod";
import { Users, Ellipsis } from "lucide-react";

import { getTrafficSourcesData } from "../_actions/get-traffic-sources-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrafficSourcesChart } from "./charts/TrafficSourcesChart";

export const TrafficSourceSchema = z.object({
  source: z.string(),
  visitors: z.number().nonnegative(),
  fill: z.string(),
});

export type TrafficSourcesType = z.infer<typeof TrafficSourceSchema>;

export async function TrafficSources() {
  const trafficSourcesData: TrafficSourcesType[] =
    await getTrafficSourcesData();

  return (
    <Card>
      <CardHeader className="relative pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Traffic Sources
        </CardTitle>
        <CardDescription>Last month</CardDescription>
        <Ellipsis className="absolute top-4 end-6 size-4 hover:cursor-pointer" />
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <TrafficSourcesChart data={trafficSourcesData} />
      </CardContent>
    </Card>
  );
}
