import { z } from "zod";

export const PaymentMethodSchema = z.object({
  paymentType: z.enum(["visa", "mastercard", "amex", "discover"], {
    required_error: "You need to select a payment type.",
  }),
  cardNumber: z.string().min(1, "Card number is required"),
  cardName: z.string().min(1, "Cardholder's name is required"),
  expiry: z.string().min(1, "Expiry date is required"),
  cvc: z.string().min(3, "CVC is required").max(4, "CVC is too long"),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  saveCard: z.boolean().optional(),
});
