"use client"

import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

import type { PricingCardType } from "../types"

import { cn, formatCurrency, getDiscountedPrice } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function RenderPrice({
  price,
  period,
  discountRate,
}: Pick<PricingCardType, "price" | "period" | "discountRate">) {
  if (!price) return null

  const finalPrice = discountRate
    ? getDiscountedPrice(price, discountRate, true)
    : price
  const fomrattedFinalPrice = formatCurrency(finalPrice)

  return (
    <div className="flex justify-center items-baseline mb-8 mt-2">
      <span className="text-4xl font-black">{fomrattedFinalPrice}</span>
      {period && <span className="text-muted-foreground">/{period}</span>}
    </div>
  )
}

export function PricingCard({
  title,
  description,
  price,
  period,
  discountRate,
  features,
  isCurrentPlan = false,
  isFeatured = false,
  buttonOptions,
  buttonContent,
  content,
  href,
}: PricingCardType) {
  const router = useRouter()

  return (
    <Card
      className={cn(
        "relative h-full flex flex-col",
        isFeatured && "border-primary"
      )}
      asChild
    >
      <li>
        {isFeatured && (
          <Badge className="absolute -top-2.5 start-3 w-fit">Featured</Badge>
        )}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <RenderPrice
            price={price}
            period={period}
            discountRate={discountRate}
          />
          {content && content}
          {features.length > 0 && (
            <ul className="space-y-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-x-3">
                  <Check className="size-4 text-success" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <CardFooter className="mt-auto">
          <Button
            size="lg"
            className="w-full"
            disabled={isCurrentPlan}
            onClick={() => router.push(href)}
            {...buttonOptions}
          >
            {buttonContent || (isCurrentPlan ? "Your Current Plan" : "Upgrade")}
          </Button>
        </CardFooter>
      </li>
    </Card>
  )
}
