"use client"

import { Landmark } from "lucide-react"

import type { PaymentMethodFormType, PaymentType } from "../types"

import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/button"
import { FormControl, FormItem, FormLabel } from "@/components/ui/form"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { CreditCardBrandIcon } from "@/components/credit-card-brand-icon"

export function SavedCard({
  card,
  onSelect,
}: {
  card: PaymentType["savedCards"][0]
  onSelect: (id: PaymentMethodFormType["savedCard"]) => void
}) {
  const isBankAccount = !card.cardType

  return (
    <FormItem>
      <FormLabel
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-full gap-x-2 cursor-pointer"
        )}
      >
        <FormControl>
          <RadioGroupItem value={card.id} onClick={() => onSelect(card.id)} />
        </FormControl>
        {isBankAccount ? (
          <>
            <span>Bank Account ending in {card.last4}</span>
            <Landmark className="h-5 w-5 ms-auto" />
          </>
        ) : (
          <>
            <div>
              <span className="capitalize">{card.cardType}</span>{" "}
              <span>ending in {card.last4}</span>
            </div>
            <CreditCardBrandIcon
              brandName={card.cardType}
              className="h-5 w-5 ms-auto"
            />
          </>
        )}
      </FormLabel>
    </FormItem>
  )
}
