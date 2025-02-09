"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CreditCard, Landmark } from "lucide-react";

import { PaymentMethodSchema } from "../../../../_schemas/payment-method-schema";
import { getCreditCardBrandName } from "@/lib/utils";

import type { PaymentType, PaymentMethodFormType } from "../../../../types";

import { Card } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { SeparatorWithText } from "@/components/ui/separator";
import { CreditCardBrandIcon } from "@/components/credit-card-brand-icon";
import { SavedCard } from "./saved-card";
import { PaymentOption } from "./payment-option";

interface PaymentMethodFormProps {
  data: PaymentType["savedCards"];
}

export function PaymentMethodForm({
  data: savedCards,
}: PaymentMethodFormProps) {
  const form = useForm<PaymentMethodFormType>({
    resolver: zodResolver(PaymentMethodSchema),
    defaultValues: {
      saveCard: false,
    },
  });

  const cardNumber = form.watch("cardNumber");
  const paymentOption = form.watch("paymentOption");

  const creditCardBrandName = getCreditCardBrandName(cardNumber);

  const handleSavedCardSelect = (id: PaymentMethodFormType["savedCard"]) => {
    form.setValue("savedCard", id);
    form.setValue("paymentOption", undefined);
  };

  const handlePaymentOptionSelect = (
    id: PaymentMethodFormType["paymentOption"]
  ) => {
    form.setValue("paymentOption", id);
    form.setValue("savedCard", undefined);
  };

  function onSubmit(data: PaymentMethodFormType) {}

  return (
    <Form {...form}>
      <Card className="w-full p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Saved Cards */}
          <FormField
            control={form.control}
            name="savedCard"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select From The Saved Cards</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value ?? ""}
                    className="space-y-4 mb-6"
                  >
                    {savedCards.map((card) => (
                      <SavedCard
                        key={card.id}
                        card={card}
                        onSelect={handleSavedCardSelect}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <SeparatorWithText>or</SeparatorWithText>

          {/* Payment Options */}
          <FormField
            control={form.control}
            name="paymentOption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Payment Option</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value ?? ""}
                    className="flex flex-col space-y-1"
                  >
                    <PaymentOption
                      id="card"
                      icon={CreditCard}
                      label="Pay with Card"
                      onClick={handlePaymentOptionSelect}
                    />
                    <PaymentOption
                      id="bank"
                      icon={Landmark}
                      label="Pay with Bank Account"
                      onClick={handlePaymentOptionSelect}
                    />
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Conditional Inputs */}
          {paymentOption === "card" && (
            <>
              <FormField
                control={form.control}
                name="cardNumber"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Card Number</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="xxxx-xxxx-xxxx-xxxx"
                        className="ps-12"
                        {...field}
                      />
                    </FormControl>
                    <div className="absolute start-3 top-[1.8rem]">
                      <CreditCardBrandIcon brandName={creditCardBrandName} />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cardName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name on Card</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-x-4">
                <FormField
                  control={form.control}
                  name="expiry"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="MM/YY" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cvc"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>CVC</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="saveCard"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-x-2">
                      <Switch
                        id="save-card"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <Label htmlFor="save-card">
                        Save card for future billing?
                      </Label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {paymentOption === "bank" && (
            <>
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your account number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="routingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Routing Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your routing number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Button type="submit" size="lg" className="w-full">
            Pay now
          </Button>
        </form>
      </Card>
    </Form>
  );
}
