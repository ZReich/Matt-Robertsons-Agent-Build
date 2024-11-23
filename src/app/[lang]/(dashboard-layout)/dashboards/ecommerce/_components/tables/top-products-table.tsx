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
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export function TopProductsTable({ data }: { data: TopProductType[] }) {
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
          const isPositiveSalesChange = product.sales.percentageChange > 0;

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
                    <Stat
                      label="Sales"
                      value={product.sales.value}
                      percentageChange={product.sales.percentageChange}
                    />
                    <Stat
                      label="Revenue"
                      value={`$${product.revenue.value.toLocaleString()}`}
                      percentageChange={product.revenue.percentageChange}
                    />
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

function Stat({
  label,
  value,
  percentageChange,
}: {
  label: string;
  value: string | number;
  percentageChange: number;
}) {
  const isPositiveChange = percentageChange >= 0;
  return (
    <div className="flex items-center gap-1 text-sm">
      <h5>{label}:</h5>
      <div className="flex items-center space-x-2">
        <p className="font-semibold">{value}</p>
        <Badge
          variant="destructive"
          className={cn(
            "justify-center",
            isPositiveChange && "bg-success hover:bg-success/90"
          )}
        >
          {isPositiveChange && <span>+</span>}
          <span>
            {new Intl.NumberFormat("en-US", {
              style: "percent",
              maximumFractionDigits: 2,
            }).format(percentageChange)}
          </span>
          <span className="ms-1" aria-hidden>
            {isPositiveChange ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
          </span>
        </Badge>
      </div>
    </div>
  );
}
