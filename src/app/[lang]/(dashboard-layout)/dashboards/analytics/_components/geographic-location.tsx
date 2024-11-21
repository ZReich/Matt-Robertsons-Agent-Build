import { EllipsisVertical } from "lucide-react";

import { geographicLocationsData } from "../_data/geographic-locations";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GeographicLocationTable } from "./tables/geographic-location-table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GeographicLocation() {
  return (
    <article className="md:col-span-5">
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Geographic Location</CardTitle>
            <CardDescription>Last month</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <ScrollArea
            orientation="horizontal"
            className="w-[calc(100vw-5rem)] md:w-auto"
          >
            <GeographicLocationTable data={geographicLocationsData} />
          </ScrollArea>
        </CardContent>
      </Card>
    </article>
  );
}
