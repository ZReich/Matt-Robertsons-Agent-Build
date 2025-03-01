"use client";

import Image from "next/image";

import { formatCurrency } from "@/lib/utils";

import type { TopProductType } from "../../../../types";

import { Card } from "@/components/ui/card";

export function TopProductsItem({
  product,
}: {
  product: TopProductType["products"][0];
}) {
  return (
    <li>
      <Card className="grid grid-cols-7 overflow-hidden">
        <div className="col-span-4 flex items-center gap-4 p-2">
          <Image
            src={product.image}
            alt={product.name}
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div className="flex flex-col truncate">
            <h3 className="font-semibold break-all truncate">
              <span className="font-normal">#{product.order}</span>{" "}
              {product.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Item: #{product.sku}
            </p>
          </div>
        </div>
        <div className="col-span-3 flex flex-col bg-accent p-2 truncate">
          <p className="text-accent-foreground font-semibold">
            <span className="font-normal">Sales: </span>
            {product.sales.value.toLocaleString()}
          </p>
          <p className="text-accent-foreground font-semibold">
            <span className="font-normal">Revenue: </span>
            {formatCurrency(product.revenue.value)}
          </p>
        </div>
      </Card>
    </li>
  );
}
