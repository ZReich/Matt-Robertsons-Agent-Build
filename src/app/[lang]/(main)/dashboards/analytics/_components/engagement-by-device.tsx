import { z } from "zod";

import { getEngagementByDeviceData } from "../_actions/get-engagement-by-device-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EngagementByDeviceTable } from "./tables/engagement-trends-table";

export const EngagementByDeviceSchema = z.object({
  device_type: z.string(),
  session_duration: z.number().nonnegative(),
  pages_per_session: z.number().nonnegative(),
  bounce_rate: z.number().min(0).max(1),
});

export type EngagementByDeviceType = z.infer<typeof EngagementByDeviceSchema>;

export async function EngagementByDevice() {
  const engagementTrendsData: EngagementByDeviceType[] =
    await getEngagementByDeviceData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement By Device</CardTitle>
        <CardDescription>Last month</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <EngagementByDeviceTable data={engagementTrendsData} />
      </CardContent>
    </Card>
  );
}
