import { z } from "zod"

export const PaymentMethodSchema = z.object({
  paymentOption: z.enum(["card", "bank"]).optional(),
  cardNumber: z.string().min(1, "Card number is required"),
  cardName: z.string().min(1, "Cardholder's name is required"),
  expiry: z.string().min(1, "Expiry date is required"),
  cvc: z.string().min(3, "CVC is required").max(4, "CVC is too long"),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  saveCard: z.boolean().optional(),
  savedCard: z.string().optional(),
})
