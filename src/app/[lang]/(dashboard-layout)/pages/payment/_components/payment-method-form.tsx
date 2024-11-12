"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreditCard, Landmark } from "lucide-react";

import { getCreditCardBrandName } from "@/lib/utils";

import type { CardType } from "../actions/getSavedCards";

import { Card } from "@/components/ui/card";
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
  FormMessage,
} from "@/components/ui/form";
import { SeparatorWithText } from "@/components/ui/separator";
import { CreditCardBrandIcon } from "@/components/CreditCardBrandIcon";

const FormSchema = z.object({
  payment_option: z.enum(["card", "bank"]).optional(),
  card_number: z.string().min(1, "Card number is required"),
  card_name: z.string().min(1, "Cardholder's name is required"),
  expiry: z.string().min(1, "Expiry date is required"),
  cvc: z.string().min(3, "CVC is required").max(4, "CVC is too long"),
  account_number: z.string().optional(),
  routing_number: z.string().optional(),
  save_card: z.boolean().optional(),
  saved_card: z.string().optional(),
});

export function PaymentMethodForm({ savedCards }: { savedCards: CardType[] }) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      save_card: false,
    },
  });

  const cardNumber = form.watch("card_number");
  const paymentOption = form.watch("payment_option");

  const creditCardBrandName = getCreditCardBrandName(cardNumber);

  function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log("Submitted data:", data);
  }

  return (
    <Form {...form}>
      <Card className="w-full p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="saved_card"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select From The Saved Cards</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value === undefined ? "" : field.value}
                    onValueChange={(e) => {
                      field.onChange(e);
                      form.setValue("payment_option", undefined);
                    }}
                    className="space-y-4 mb-6"
                  >
                    {savedCards.map((card) => {
                      const isBankAccount = !card?.card_type;

                      return (
                        <Card
                          key={card.id}
                          className="flex items-center gap-x-2 p-4"
                        >
                          <RadioGroupItem value={card.id} id={card.id} />
                          <Label
                            htmlFor={card.id}
                            className="w-full flex items-center justify-start gap-2 cursor-pointer"
                          >
                            {isBankAccount ? (
                              <>
                                <span>Bank Account ending in {card.last4}</span>
                                <Landmark className="size-8 ms-auto" />
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="capitalize">
                                    {card.card_type}
                                  </span>{" "}
                                  <span>ending in {card.last4}</span>
                                </div>
                                <img
                                  src={`/images/logos/${card.card_type}.svg`}
                                  alt={`${card.card_type} logo`}
                                  className="h-6 ms-auto md:h-8"
                                />
                              </>
                            )}
                          </Label>
                        </Card>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <SeparatorWithText>or</SeparatorWithText>

          <FormField
            control={form.control}
            name="payment_option"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Payment Option</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value === undefined ? "" : field.value}
                    onValueChange={(e) => {
                      field.onChange(e);
                      form.setValue("saved_card", undefined);
                    }}
                    className="flex flex-col space-y-1"
                  >
                    <Card className="flex items-center gap-x-2 p-4">
                      <RadioGroupItem value="card" id="card" />
                      <Label
                        htmlFor="card"
                        className="w-full flex items-center justify-start cursor-pointer"
                      >
                        <CreditCard className="me-2 stroke-[1.5] text-foreground" />
                        Pay with Card
                      </Label>
                    </Card>
                    <Card className="flex items-center gap-x-2 p-4">
                      <RadioGroupItem value="bank" id="bank" />
                      <Label
                        htmlFor="bank"
                        className="w-full flex items-center justify-start cursor-pointer"
                      >
                        <Landmark className="me-2 stroke-[1.5] text-foreground" />
                        Pay with Bank Account
                      </Label>
                    </Card>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {paymentOption === "card" && (
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
                name="card_name"
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
