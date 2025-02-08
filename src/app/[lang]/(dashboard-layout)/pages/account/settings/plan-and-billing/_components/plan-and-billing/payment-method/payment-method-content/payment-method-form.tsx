"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CreditCard, Landmark, LoaderCircle } from "lucide-react";

import { PaymentMethodSchema } from "../../../../_schemas/payment-method-schema";

import { getCreditCardBrandName } from "@/lib/utils";

import type { PaymentMethodFormType } from "@/app/[lang]/(dashboard-layout)/pages/account/types";

import { CreditCardBrandIcon } from "@/components/credit-card-brand-icon";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  FormDescription,
  FormMessage,
} from "@/components/ui/form";

export function PaymentMethodForm() {
  const [paymentMethod, setPaymentMethod] = useState("card");

  const form = useForm<PaymentMethodFormType>({
    resolver: zodResolver(PaymentMethodSchema),
    defaultValues: {
      paymentType: "visa",
      cardNumber: "",
      cardName: "",
      expiry: "",
      cvc: "",
      accountNumber: "",
      routingNumber: "",
      saveCard: false,
    },
  });

  const cardNumber = form.watch("cardNumber");
  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid; // Disable button if form is invalid, or submitting
  const creditCardBrandName = getCreditCardBrandName(cardNumber);

  function onSubmit(data: PaymentMethodFormType) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="paymentType"
          render={() => (
            <FormItem>
              <FormLabel>Select Payment Type</FormLabel>
              <FormControl>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center gap-x-2">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center">
                      <CreditCard className="me-2 stroke-[1.5] text-foreground" />
                      Pay with Card
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <RadioGroupItem value="bank" id="bank" />
                    <Label htmlFor="bank" className="flex items-center">
                      <Landmark className="me-2 stroke-[1.5] text-foreground" />
                      Pay with Bank Account
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormDescription>
                Choose between card or bank payment options
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fields displayed when "card" is selected */}
        {paymentMethod === "card" && (
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
                      placeholder="1234 5678 9012 3456"
                      className="ps-12"
                      {...field}
                    />
                  </FormControl>
                  <div className="absolute start-3 top-[1.8rem]">
                    <CreditCardBrandIcon brandName={creditCardBrandName} />
                  </div>
                  <FormDescription>
                    Enter your 16-digit card number
                  </FormDescription>
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
                  <FormDescription>
                    Enter the name as shown on your card
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-4">
              <FormField
                control={form.control}
                name="expiry"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="MM/YY" />
                    </FormControl>
                    <FormDescription>
                      Enter the expiry date of your card
                    </FormDescription>
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
                    <FormDescription>
                      Enter the 3 or 4 digit CVC code
                    </FormDescription>
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
                  <FormDescription>
                    Toggle if you want to save this card
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Fields displayed when "bank" is selected */}
        {paymentMethod === "bank" && (
          <>
            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter your account number" />
                  </FormControl>
                  <FormDescription>
                    Enter your bank account number
                  </FormDescription>
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
                    <Input {...field} placeholder="Enter your routing number" />
                  </FormControl>
                  <FormDescription>
                    Enter your bank routing number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <Button
          type="submit"
          className="mt-6"
          disabled={isDisabled}
          aria-live="assertive"
        >
          {isSubmitting && (
            <LoaderCircle
              className="me-2 size-4 animate-spin"
              aria-label="Loading"
            />
          )}
          Save
        </Button>
      </form>
    </Form>
  );
}
