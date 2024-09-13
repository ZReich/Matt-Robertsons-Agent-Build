"use client";

import Link from "next/link";
import { z } from "zod";
import flags from "react-phone-number-input/flags";
import { Country } from "react-phone-number-input";

import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";

const SalesByCountrySchema = z.object({
  country: z.string(),
  countryCode: z.string(),
  sales: z.number().nonnegative(),
});

type SalesByCountry = z.infer<typeof SalesByCountrySchema>;

export function SalesByCountry() {
  const salesByCountryData: SalesByCountry[] = [
    { country: "United States", countryCode: "US", sales: 8450 },
    { country: "Brazil", countryCode: "BR", sales: 7780 },
    { country: "India", countryCode: "IN", sales: 6480 },
    { country: "Australia", countryCode: "AU", sales: 5120 },
    { country: "France", countryCode: "FR", sales: 4450 },
    { country: "China", countryCode: "CN", sales: 3900 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales By Country</CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Sales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesByCountryData.map((item, index) => {
              const Flag = flags[
                item.countryCode as Country
              ] as React.ElementType;

              return (
                <TableRow key={item.country}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Flag title={item.country} className="h-4 rounded-sm" />
                    {item.country}
                  </TableCell>
                  <TableCell>${item.sales.toLocaleString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
