import { z } from "zod";
import { Users, Ellipsis } from "lucide-react";

import { getConversionFunnelData } from "../_actions/get-conversion-funnel-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConversionFunnelChart } from "./charts/conversion-funnel-chart";

export const ConversionFunnelSchema = z.object({
  visited_page: z.number().nonnegative(),
  added_to_cart: z.number().nonnegative(),
  initiated_checkout: z.number().nonnegative(),
  completed_purchase: z.number().nonnegative(),
});

export type ConversionFunnelType = z.infer<typeof ConversionFunnelSchema>;

export async function ConversionFunnel() {
  const conversionFunnelData: ConversionFunnelType =
    await getConversionFunnelData();

  return (
    <Card>
      <CardHeader className="relative pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Conversion Funnel
        </CardTitle>
        <CardDescription>Last month</CardDescription>
        <Ellipsis className="absolute top-4 end-6 size-4 hover:cursor-pointer" />
      </CardHeader>
      <CardContent>
        <ConversionFunnelChart data={conversionFunnelData} />
      </CardContent>
    </Card>
  );
}
