import * as React from "react";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentMethodForm } from "./_components/payment-method-form";
import { PaymentSummary } from "./_components/payment-summary";

export interface SavedCard {
  id: string;
  card_type?: string;
  card_number?: string;
  card_name: string;
  expiry?: string;
  cvc?: string;
  account_number?: string;
  routing_number?: string;
  last4?: string;
}

export const CardSchema = z.object({
  id: z.string(),
  card_type: z.string().optional(),
  card_number: z.string().optional(),
  card_name: z.string(),
  expiry: z.string().optional(),
  cvc: z.string().optional(),
  account_number: z.string().optional(),
  routing_number: z.string().optional(),
  last4: z.string().optional(),
});

export type CardType = z.infer<typeof CardSchema>;

export default function PaymentPage() {
  const savedCards: CardType[] = [
    {
      id: "1",
      card_type: "Visa",
      card_number: "4532 9876 5432 1234",
      card_name: "John Doe",
      expiry: "11/24",
      cvc: "832",
      last4: "1234",
    },
    {
      id: "2",
      card_type: "Mastercard",
      card_number: "6011 1234 5678 9012",
      card_name: "John Doe",
      expiry: "05/26",
      cvc: "237",
      last4: "9012",
    },
    {
      id: "3",
      card_name: "John Doe",
      account_number: "789654123",
      routing_number: "021000021",
      last4: "4123",
    },
  ];

  return (
    <section className="container py-8 lg:py-16">
      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 lg:flex-row">
          <PaymentMethodForm savedCards={savedCards} />
          <PaymentSummary
            originalPrice="6,592.00"
            savings="299.00"
            storePickup="99"
            tax="799"
            total="7,191.00"
          />
        </CardContent>
        <CardFooter className="justify-center md:justify-start">
          <p className="text-sm text-muted-foreground">
            Payment processed by{" "}
            <a href="#" className="underline">
              Stripe
            </a>{" "}
            for{" "}
            <a href="#" className="underline">
              Shadboard
            </a>{" "}
            - United States Of America
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
