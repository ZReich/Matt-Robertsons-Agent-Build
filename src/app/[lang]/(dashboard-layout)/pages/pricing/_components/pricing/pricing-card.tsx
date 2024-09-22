import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PricingCardProps {
  title: string;
  description: string;
  price: number;
  period?: string;
  features: string[];
  isCurrentPlan?: boolean;
  isPopular?: boolean;
}

export function PricingCard({
  title,
  description,
  price,
  period = "month",
  features,
  isCurrentPlan = false,
  isPopular = false,
}: PricingCardProps) {
  return (
    <Card className={cn("relative flex flex-col", isPopular && "border-primary")}>
      {isPopular && <Badge className="absolute -top-2.5 start-3 w-fit">Most popular</Badge>}
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center items-baseline mb-8 mt-2">
          <span className="text-4xl font-black">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(price / 100)}
          </span>
          <span className="text-muted-foreground">/{period}</span>
        </div>
        <ul className="space-y-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center space-x-3">
              <Check className="size-4 text-success" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button size="lg" className="w-full " disabled={isCurrentPlan}>
          {isCurrentPlan ? "Your Current Plan" : "Upgrade"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function PricingCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="text-center">
        <CardTitle className="my-1">
          <Skeleton className="w-20 h-7 mx-auto" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="w-2/3  h-4 mx-auto" />
        </CardDescription>
      </CardHeader>
      <CardContent className="my-5">
        <div className="flex justify-center items-baseline mb-10 mt-2 space-x-2">
          <Skeleton className="w-16 h-12" />
          <Skeleton className="w-14 h-5" />
        </div>
        <ul className="space-y-5">
          <li className="flex items-center space-x-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="w-3/4 h-4" />
          </li>
          <li className="flex items-center space-x-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="w-3/4 h-4" />
          </li>
          <li className="flex items-center space-x-3">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="w-3/4 h-4" />
          </li>
        </ul>
      </CardContent>
      <CardFooter className="mt-auto">
        <Skeleton className="w-full h-10" />
      </CardFooter>
    </Card>
  );
}
