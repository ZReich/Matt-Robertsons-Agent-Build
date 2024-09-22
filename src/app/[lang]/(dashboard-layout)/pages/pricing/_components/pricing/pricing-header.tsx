"use client";

import * as React from "react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PricingHeaderProps {
  isAnnual: boolean;
  setIsAnnual: (isAnnual: boolean) => void;
}

export function PricingHeader({ isAnnual, setIsAnnual }: PricingHeaderProps) {
  return (
    <div className="mx-auto max-w-screen-md text-center mb-8 md:mb-12">
      <h2 className="mb-4 text-2xl tracking-tight font-bold text-foreground">
        Flexible Pricing Plans
      </h2>
      <p className="mb-5 font-light text-muted-foreground md:text-xl">
        Choose from our flexible pricing plans to find the perfect fit for your
        needs. and capital can unlock long-term value and drive economic growth.
      </p>

      <Label
        htmlFor="annual-billing"
        className="flex items-center justify-center gap-2"
      >
        <span>Monthly</span>
        <Switch
          checked={isAnnual}
          onCheckedChange={() => setIsAnnual(!isAnnual)}
        />
        <span>Yearly (Save 15%)</span>
      </Label>
    </div>
  );
}
