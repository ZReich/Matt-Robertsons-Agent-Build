import { z } from "zod"

export const PaymentMethodSchema = z.object({
  paymentOption: z.enum(["card", "bank"]).optional(),
  cardNumber: z
    .string()
    .min(13, "Card number must be at least 13 digits")
    .max(19, "Card number must be at most 19 digits"),
  cardName: z.string().min(1, "Cardholder's name is required"),
  expiry: z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/,
      "Expiry date must be in MM/YY or MM/YYYY format"
    ),
  cvc: z
    .string()
    .min(3, "CVC must be at least 3 digits")
    .max(4, "CVC must be at most 4 digits"),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  saveCard: z.boolean().optional(),
  savedCard: z.string().optional(),
})
