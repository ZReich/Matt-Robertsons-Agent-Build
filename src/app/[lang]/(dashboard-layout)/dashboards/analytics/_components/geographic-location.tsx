import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { getGeographicLocationsData } from "../_actions/get-geographic-locations-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { GeographicLocationTable } from "./tables/geographic-location-table";

export const GeographicLocationSchema = z.object({
  country: z.string(),
  country_code: z.string().length(2),
  visitors: z.number().nonnegative(),
});

export type GeographicLocationType = z.infer<typeof GeographicLocationSchema>;

export async function GeographicLocation() {
  const geographicLocationsData: GeographicLocationType[] =
    await getGeographicLocationsData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Location</CardTitle>
        <CardDescription>Last month</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <GeographicLocationTable data={geographicLocationsData} />
      </CardContent>
      <CardFooter>
        <Link
          href="#"
          className={cn(buttonVariants({ variant: "link" }), "mt-4 w-full")}
        >
          View More
        </Link>
      </CardFooter>
    </Card>
  );
}
