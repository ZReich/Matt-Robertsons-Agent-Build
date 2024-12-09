import { Check } from "lucide-react";

import { DISCOUNT_RATE } from "../../constants";

import { cn, formatCurrency, getDiscountedPrice } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PricingCardProps {
  title: string;
  description: string;
  price: number;
  period?: string;
  features: string[];
  isAnnual?: boolean;
  isCurrentPlan?: boolean;
  isPopular?: boolean;
}

export function PricingCard({
  title,
  description,
  price,
  period = "month",
  features,
  isAnnual = false,
  isCurrentPlan = false,
  isPopular = false,
}: PricingCardProps) {
  // If it's an annual plan, apply discount for annual plan; otherwise, use the regular price for monthly plan
  const finalPrice = isAnnual
    ? getDiscountedPrice(price, DISCOUNT_RATE, true)
    : price;

  return (
    <article>
      <Card
        className={cn(
          "relative h-full flex flex-col",
          isPopular && "border-primary"
        )}
      >
        {isPopular && (
          <Badge className="absolute -top-2.5 start-3 w-fit">
            Most popular
          </Badge>
        )}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-baseline mb-8 mt-2">
            <span className="text-4xl font-black">
              {formatCurrency(finalPrice)}
            </span>
            <span className="text-muted-foreground">/{period}</span>
          </div>
          <ul className="space-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-center space-x-3">
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
    </article>
  );
}
