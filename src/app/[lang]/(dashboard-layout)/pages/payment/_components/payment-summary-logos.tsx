"use client"

import { CreditCardBrandIcon } from "@/components/credit-card-brand-icon"

const paymentSummaryLogos = [
  {
    name: "americanexpress",
    label: "American Eexpress",
  },
  {
    name: "discover",
    label: "Discover",
  },
  {
    name: "mastercard",
    label: "Mastercard",
  },
  { name: "visa", label: "Visa" },
]

export function PaymentSummaryLogos() {
  return (
    <div className="flex justify-evenly items-center gap-x-3 mt-4">
      {paymentSummaryLogos.map((logo) => (
        <CreditCardBrandIcon
          key={logo.name}
          brandName={logo.name}
          className="h-12 w-12"
          aria-label={logo.label}
        />
      ))}
    </div>
  )
}
