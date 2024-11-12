"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreditCard, Landmark, LoaderCircle } from "lucide-react";

import { getCreditCardBrandName } from "@/lib/utils";

import { CreditCardBrandIcon } from "@/components/CreditCardBrandIcon";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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

const FormSchema = z.object({
  payment_type: z.enum(["visa", "mastercard", "amex", "discover"], {
    required_error: "You need to select a payment type.",
  }),
  card_number: z.string().min(1, "Card number is required"),
  card_name: z.string().min(1, "Cardholder's name is required"),
  expiry: z.string().min(1, "Expiry date is required"),
  cvc: z.string().min(3, "CVC is required").max(4, "CVC is too long"),
  account_number: z.string().optional(),
  routing_number: z.string().optional(),
  save_card: z.boolean().optional(),
});

export function PaymentMethodForm() {
  const [paymentMethod, setPaymentMethod] = useState("card");

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      payment_type: "visa",
      save_card: false,
    },
  });

  const cardNumber = form.watch("card_number");
  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;
  const creditCardBrandName = getCreditCardBrandName(cardNumber);

  function onSubmit(data: z.infer<typeof FormSchema>) {}

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>
          Choose your payment method and enter your details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="payment_type"
              render={() => (
                <FormItem>
                  <FormLabel>Select Payment Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="flex items-center">
                          <CreditCard className="me-2 stroke-[1.5] text-foreground" />
                          Pay with Card
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
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

            {paymentMethod === "card" && (
              <>
                <FormField
                  control={form.control}
                  name="card_number"
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
                  name="card_name"
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
                  name="save_card"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center space-x-2">
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

            {paymentMethod === "bank" && (
              <>
                <FormField
                  control={form.control}
                  name="account_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter your account number"
                        />
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
                  name="routing_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Routing Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter your routing number"
                        />
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
              {isDisabled && (
                <LoaderCircle
                  className="me-2 size-4 animate-spin"
                  aria-label="Loading"
                />
              )}
              Save
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
