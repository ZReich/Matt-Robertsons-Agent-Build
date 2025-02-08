"use client";

import type { PaymentMethodFormType } from "../../../../types";

import { Card } from "@/components/ui/card";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function PaymentOption({
  id,
  icon: Icon,
  label,
  onClick,
}: {
  id: PaymentMethodFormType["paymentOption"];
  icon: React.ElementType;
  label: string;
  onClick: (id: PaymentMethodFormType["paymentOption"]) => void;
}) {
  return (
    <Card className="flex items-center gap-x-2 p-4">
      <RadioGroupItem
        value={id as string}
        id={id}
        onClick={() => onClick(id)}
      />
      <Label htmlFor={id} className="w-full flex items-center justify-start">
        <Icon className="me-2 stroke-[1.5] text-foreground" />
        {label}
      </Label>
    </Card>
  );
}
