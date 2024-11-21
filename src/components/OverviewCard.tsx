import { TrendingUp, TrendingDown, EllipsisVertical } from "lucide-react";

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
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface OverviewCardProps {
  data: {
    value: number;
    percentageChange: number;
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
  const isPositiveChange = data.percentageChange >= 0;

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
        maximumFractionDigits: 0,
      }).format(data.value);
      break;
    default:
      value = data.value.toLocaleString();
      break;
  }

  return (
    <article>
      <Card className="flex flex-col justify-between">
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle className="inline-flex gap-x-1">
              <Icon className="size-4" aria-hidden />
              <span>{title}</span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-bold break-all">{value}</p>
          <div
            className={cn(
              "flex items-center gap-1",
              isPositiveChange && "text-success"
            )}
          >
            <Badge
              variant="destructive"
              className={cn(
                "justify-center",
                isPositiveChange && "bg-success hover:bg-success/90"
              )}
            >
              {isPositiveChange && <span>+</span>}
              <span>{data.percentageChange * 100 + "%"}</span>
              <span className="ms-1" aria-hidden>
                {isPositiveChange ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
              </span>
            </Badge>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
