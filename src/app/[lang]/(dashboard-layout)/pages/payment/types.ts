import type { z } from "zod"
import type { PaymentMethodSchema } from "./_schemas/payment-method-schema"

export type CardType = Omit<PaymentMethodFormType, "saveCard"> & {
  id: string
  cardType: string
  last4: string
  isDefault: boolean
}

export interface PaymentType {
  summary: {
    originalPrice: number
    savings: number
    storePickup: number
    tax: number
    total: number
  }
  savedCards: CardType[]
}

export type PaymentMethodFormType = z.infer<typeof PaymentMethodSchema>
