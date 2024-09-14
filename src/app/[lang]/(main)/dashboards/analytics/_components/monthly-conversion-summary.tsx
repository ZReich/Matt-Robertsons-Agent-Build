import { z } from "zod";

import { getMonthlyConversionSummaryData } from "../_actions/get-monthly-conversion-summary-data";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyConversionSummaryTable } from "./tables/monthly-conversion-summary-table";

export const MonthlyConversionSummarySchema = z.object({
  month: z.string(),
  conversions: z.number().nonnegative(),
  revenue: z.number(),
});

export type MonthlyConversionSummaryType = z.infer<
  typeof MonthlyConversionSummarySchema
>;

export async function MonthlyConversionSummary() {
  const monthlyConversionSummaryData: MonthlyConversionSummaryType[] =
    await getMonthlyConversionSummaryData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Conversion Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <MonthlyConversionSummaryTable data={monthlyConversionSummaryData} />
      </CardContent>
    </Card>
  );
}
