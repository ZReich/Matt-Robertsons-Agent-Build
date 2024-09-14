import { TrendingUp, TrendingDown, Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/date-formatters";

import { Icon } from "@/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OverviewCardProps {
  data: {
    value: number;
    percentage_change: number;
  };
  title: string;
  description: string;
  icon: Icon;
  formatStyle?: "percent" | "duration" | "currency" | "regular";
}

export function OverviewCard({
  data,
  title,
  description,
  icon: Icon,
  formatStyle = "regular",
}: OverviewCardProps) {
  const isPositiveChange = data.percentage_change >= 0;

  let value;
  switch (formatStyle) {
    case "percent":
      value = new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(data.value);
      break;
    case "duration":
      value = formatDuration(data.value);
      break;
    case "currency":
      value = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(data.value);
      break;
    default:
      value = data.value.toLocaleString();
      break;
  }

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="flex-row justify-between items-start gap-2 py-4">
        <div className="py-1">
          <CardTitle className="inline-flex gap-x-1">
            <Icon className="size-4" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Ellipsis className="size-4 hover:cursor-pointer" />
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-bold break-all">{value}</p>
        <div
          className={cn(
            "flex items-center gap-1",
            isPositiveChange && "text-green-500"
          )}
        >
          <Badge
            variant={isPositiveChange ? "default" : "destructive"}
            className={cn(
              isPositiveChange && "bg-green-500 hover:bg-green-600"
            )}
          >
            {isPositiveChange && "+"}
            {new Intl.NumberFormat("en-US", {
              style: "percent",
              maximumFractionDigits: 2,
            }).format(data.percentage_change)}
          </Badge>
          {isPositiveChange ? (
            <TrendingUp className="size-4 text-green-500" />
          ) : (
            <TrendingDown className="size-4 text-destructive" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
