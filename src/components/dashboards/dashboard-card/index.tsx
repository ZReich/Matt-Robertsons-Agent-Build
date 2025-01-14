import * as React from "react";
import { EllipsisVertical } from "lucide-react";

import { formatOverviewCardValue } from "./format-overview-card-value";

import type { FormatStyleType, IconType } from "@/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PercentageChangeBadge } from "../percentage-change-badge";

interface DashboardCardProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  period: string;
}

const DashboardCard = React.forwardRef<HTMLElement, DashboardCardProps>(
  ({ title, period, children, ...props }, ref) => (
    <article ref={ref} {...props}>
      <Card>
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{period}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </article>
  )
);
DashboardCard.displayName = "DashboardCard";

interface DashboardCardWithoutPeriodProps
  extends React.HTMLAttributes<HTMLElement> {
  title: string;
}

const DashboardCardWithoutPeriod = React.forwardRef<
  HTMLElement,
  DashboardCardWithoutPeriodProps
>(({ title, children, ...props }, ref) => (
  <article ref={ref} {...props}>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  </article>
));
DashboardCardWithoutPeriod.displayName = "DashboardCardWithoutPeriod";

interface DashboardOverviewCardProps extends React.HTMLAttributes<HTMLElement> {
  data: {
    value: number;
    percentageChange: number;
  };
  title: string;
  period: string;
  icon: IconType;
  formatStyle?: FormatStyleType;
}

const DashboardOverviewCard = React.forwardRef<
  HTMLElement,
  DashboardOverviewCardProps
>(
  (
    { data, title, period, icon: Icon, formatStyle = "regular", ...props },
    ref
  ) => {
    const value = formatOverviewCardValue(data.value, formatStyle);

    return (
      <article ref={ref} {...props}>
        <Card className="flex flex-col justify-between">
          <CardHeader className="flex-row justify-between items-start">
            <div>
              <CardTitle className="inline-flex gap-x-1">
                <Icon className="size-4" aria-hidden />
                <span>{title}</span>
              </CardTitle>
              <CardDescription>{period}</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More actions">
                <EllipsisVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold break-all">{value}</p>
            <PercentageChangeBadge value={data.percentageChange} />
          </CardContent>
        </Card>
      </article>
    );
  }
);
DashboardOverviewCard.displayName = "DashboardOverviewCard";

export { DashboardCard, DashboardCardWithoutPeriod, DashboardOverviewCard };
