import { Check } from "lucide-react";

import { cn, formatCurrency } from "@/lib/utils";

import type { ButtonProps } from "../ui/button";

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
import Image from "next/image";
import Link from "next/link";

interface PricingCardProps {
  title: string;
  description: string;
  price: number | null;
  period?: string;
  features: string[];
  isCurrentPlan?: boolean;
  featured?: boolean;
  buttonOptions?: ButtonProps;
  buttonContent?: React.ReactNode;
  content?: React.ReactNode;
  href: string;
}

export function PricingCard({
  title,
  description,
  price,
  period = "month",
  features,
  isCurrentPlan = false,
  featured = false,
  buttonOptions,
  buttonContent,
  content,
  href,
}: PricingCardProps) {
  return (
    <li>
      <Card
        className={cn(
          "relative h-full flex flex-col",
          featured && "border-primary"
        )}
      >
        {featured && (
          <Badge className="absolute -top-2.5 start-3 w-fit">Featured</Badge>
        )}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {price && (
            <div className="flex justify-center items-baseline mb-8 mt-2">
              <span className="text-4xl font-black">
                {formatCurrency(price)}
              </span>
              <span className="text-muted-foreground">/{period}</span>
            </div>
          )}
          {content && content}
          <ul className="space-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-x-3">
                <Check className="size-4 text-success" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="mt-auto">
          <Button
            size="lg"
            className="w-full"
            disabled={isCurrentPlan}
            {...buttonOptions}
            asChild
          >
            <Link href={href}>
              {buttonContent ||
                (isCurrentPlan ? "Your Current Plan" : "Upgrade")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </li>
  );
}
