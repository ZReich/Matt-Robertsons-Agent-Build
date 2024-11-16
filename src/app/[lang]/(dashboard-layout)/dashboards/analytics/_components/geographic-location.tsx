import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { geographicLocationsData } from "../_data/geographic-locations";

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
  percentage_change: z.number(),
});

export type GeographicLocationType = z.infer<typeof GeographicLocationSchema>;

export async function GeographicLocation() {
  return (
    <article>
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
            className={cn(buttonVariants({ variant: "link" }), "w-full")}
          >
            View More
          </Link>
        </CardFooter>
      </Card>
    </article>
  );
}
