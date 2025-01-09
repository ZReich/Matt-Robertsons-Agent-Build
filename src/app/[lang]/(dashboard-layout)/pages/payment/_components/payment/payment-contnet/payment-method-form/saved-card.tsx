"use client";

import Image from "next/image";
import { Landmark } from "lucide-react";

import type { PaymentType } from "../../../../types";
import type { FormType } from ".";

import { Card } from "@/components/ui/card";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function SavedCard({
  card,
  onSelect,
}: {
  card: PaymentType["savedCards"][0];
  onSelect: (id: FormType["savedCard"]) => void;
}) {
  const isBankAccount = !card.cardType;

  return (
    <Card key={card.id} className="flex items-center gap-x-2 p-4">
      <RadioGroupItem
        value={card.id}
        id={card.id}
        onClick={() => onSelect(card.id)}
      />
      <Label
        htmlFor={card.id}
        className="w-full flex items-center justify-start gap-2 cursor-pointer"
      >
        {isBankAccount ? (
          <>
            <span>Bank Account ending in {card.last4}</span>
            <Landmark className="ms-auto text-foreground" />
          </>
        ) : (
          <>
            <div>
              <span className="capitalize">{card.cardType}</span>{" "}
              <span>ending in {card.last4}</span>
            </div>
            <Image
              src={`/images/logos/${card.cardType?.toLowerCase()}.svg`}
              alt={`${card.cardType} logo`}
              className="ms-auto"
              width={48}
              height={48}
            />
          </>
        )}
      </Label>
    </Card>
  );
}
