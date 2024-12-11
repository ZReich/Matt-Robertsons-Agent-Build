"use client";

import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { TopProductType } from "../../types";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn, formatCurrency, formatPercent, isNonNegative } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export function TopProductsCarousel({
  data,
}: {
  data: TopProductType["products"];
}) {
  const { settings } = useSettings();

  const layout = settings.layout;

  return (
    <Carousel
      plugins={[
        Autoplay({
          delay: 2500,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
        }),
      ]}
      opts={{
        align: "start",
        loop: true,
      }}
      orientation="vertical"
      className="w-full select-none"
    >
      <CarouselContent className="h-[500px] grid gap-2">
        {data.map((product, index) => {
          const isNonNegativeRevenueChange = isNonNegative(
            product.revenue.percentageChange
          );
          const isNonNegativeSalesChange = isNonNegative(
            product.sales.percentageChange
          );

          return (
            <CarouselItem key={product.sku}>
              <Card className="overflow-hidden">
                <CardContent
                  className={cn(
                    "grid p-0 md:grid-cols-2",
                    layout === "vertical" && "md:grid-cols-1"
                  )}
                >
                  <div className="flex items-center gap-4 p-4">
                    <Image
                      src={product.image}
                      alt={product.name}
                      width={80}
                      height={80}
                      className="rounded-lg"
                    />
                    <div className="flex flex-col truncate">
                      <p aria-label="Order">#{index + 1}</p>
                      <h4 className="font-semibold break-all truncate">
                        {product.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Item: #{product.sku}
                      </p>
                    </div>
                  </div>
                  <div className="bg-accent p-4 space-y-2">
                    <div className="flex items-center gap-1 text-sm">
                      <h5>Sales:</h5>
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold">
                          {formatCurrency(product.revenue.value)}
                        </p>
                        <Badge
                          variant="destructive"
                          className={cn(
                            "justify-center",
                            isNonNegativeRevenueChange &&
                              "bg-success hover:bg-success/90"
                          )}
                        >
                          {isNonNegativeRevenueChange && <span>+</span>}
                          <span>
                            {formatPercent(product.revenue.percentageChange)}
                          </span>
                          <span className="ms-1" aria-hidden>
                            {isNonNegativeRevenueChange ? (
                              <TrendingUp className="size-4" />
                            ) : (
                              <TrendingDown className="size-4" />
                            )}
                          </span>
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <h5>Revenue:</h5>
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold">
                          {formatCurrency(product.revenue.value)}
                        </p>
                        <Badge
                          variant="destructive"
                          className={cn(
                            "justify-center",
                            isNonNegativeSalesChange &&
                              "bg-success hover:bg-success/90"
                          )}
                        >
                          {isNonNegativeSalesChange && <span>+</span>}
                          <span>{formatPercent(product.revenue.value)}</span>
                          <span className="ms-1" aria-hidden>
                            {isNonNegativeSalesChange ? (
                              <TrendingUp className="size-4" />
                            ) : (
                              <TrendingDown className="size-4" />
                            )}
                          </span>
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <h5>Stock:</h5>
                      <p className="font-semibold">
                        {product.inventoryLeft} units
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          );
        })}
      </CarouselContent>
    </Carousel>
  );
}
