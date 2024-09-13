"use client";

import Link from "next/link";
import { z } from "zod";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SalesRepresentativeSchema = z.object({
  name: z.string(),
  sales: z.number(),
});

export type SalesRepresentative = z.infer<typeof SalesRepresentativeSchema>;

export function TopSalesRepresentatives() {
  const salesRepresentativeData: SalesRepresentative[] = [
    { name: "John Doe", sales: 50000 },
    { name: "Jane Smith", sales: 45000 },
    { name: "Bob Johnson", sales: 40000 },
    { name: "Alice Williams", sales: 55000 },
    { name: "Eve Davis", sales: 60000 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Sales Representatives</CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Avatar</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesRepresentativeData.map((rep, index) => (
              <TableRow key={rep.name}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Avatar className="size-9">
                    <AvatarImage
                      src={`/images/avatars/0${index + 1}.png`}
                      alt="Avatar"
                    />
                    <AvatarFallback className="bg-transparent">
                      JD
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>{rep.name}</TableCell>
                <TableCell>${rep.sales.toLocaleString()}</TableCell>
              </TableRow>
            ))}
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
