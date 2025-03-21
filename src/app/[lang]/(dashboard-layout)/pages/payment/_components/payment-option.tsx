"use client"

import type { PaymentMethodFormType } from "../types"

import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/button"
import { FormControl, FormItem, FormLabel } from "@/components/ui/form"
import { RadioGroupItem } from "@/components/ui/radio-group"

export function PaymentOption({
  id,
  icon: Icon,
  label,
  onClick,
}: {
  id: PaymentMethodFormType["paymentOption"]
  icon: React.ElementType
  label: string
  onClick: (id: PaymentMethodFormType["paymentOption"]) => void
}) {
  return (
    <FormItem>
      <FormLabel
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-full gap-x-2 cursor-pointer"
        )}
      >
        <FormControl>
          <RadioGroupItem value={id || ""} onClick={() => onClick(id)} />
        </FormControl>
        <span>{label}</span>
        <Icon className="h-5 w-5 ms-auto" />
      </FormLabel>
    </FormItem>
  )
}
