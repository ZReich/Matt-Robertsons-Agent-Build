"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreditCard, Landmark } from "lucide-react";

import { PaymentMethodSchema } from "../../_schemas/payment-method-schema";

import { getCreditCardBrandName } from "@/lib/utils";

import type { PaymentType } from "../../types";

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
import { CreditCardBrandIcon } from "@/components/credit-card-brand-icon";

type FormType = z.infer<typeof PaymentMethodSchema>;

export function PaymentMethodForm({
  data: savedCards,
}: {
  data: PaymentType["savedCards"];
}) {
  const form = useForm<FormType>({
    resolver: zodResolver(PaymentMethodSchema),
    defaultValues: {
      saveCard: false,
    },
  });

  const cardNumber = form.watch("cardNumber");
  const paymentOption = form.watch("paymentOption");

  const creditCardBrandName = getCreditCardBrandName(cardNumber);

  function onSubmit(data: FormType) {}

  return (
    <Form {...form}>
      <Card className="w-full p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="savedCard"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select From The Saved Cards</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value ?? ""}
                    onValueChange={(e) => {
                      field.onChange(e);
                      form.setValue("paymentOption", undefined);
                    }}
                    className="space-y-4 mb-6"
                  >
                    {savedCards.map((card) => {
                      const isBankAccount = !card?.cardType;

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
                                    {card.cardType}
                                  </span>{" "}
                                  <span>ending in {card.last4}</span>
                                </div>
                                <Image
                                  src={`/images/logos/${card.cardType?.toLowerCase()}.svg`}
                                  alt={`${card.cardType} logo`}
                                  className="ms-auto"
                                  width={48}
                                  height={48}
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
            name="paymentOption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Payment Option</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value ?? ""}
                    onValueChange={(e) => {
                      field.onChange(e);
                      form.setValue("savedCard", undefined);
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
                name="saveCard"
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
