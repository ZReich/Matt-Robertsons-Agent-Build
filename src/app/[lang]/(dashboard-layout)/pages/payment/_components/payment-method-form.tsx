"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CreditCard, Landmark } from "lucide-react"

import type { PaymentMethodFormType, PaymentType } from "../types"

import { PaymentMethodSchema } from "../_schemas/payment-method-schema"

import { getCreditCardBrandName } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { SeparatorWithText } from "@/components/ui/separator"
import { CreditCardBrandIcon } from "@/components/credit-card-brand-icon"
import { PaymentOption } from "./payment-option"
import { SavedCard } from "./saved-card"

interface PaymentMethodFormProps {
  data: PaymentType["savedCards"]
}

export function PaymentMethodForm({
  data: savedCards,
}: PaymentMethodFormProps) {
  const form = useForm<PaymentMethodFormType>({
    resolver: zodResolver(PaymentMethodSchema),
    defaultValues: {
      paymentOption: undefined,
      cardNumber: "",
      cardName: "",
      expiry: "",
      cvc: "",
      accountNumber: "",
      routingNumber: "",
      saveCard: false,
      savedCard: "",
    },
  })

  const cardNumber = form.watch("cardNumber")
  const paymentOption = form.watch("paymentOption")
  const creditCardName = getCreditCardBrandName(cardNumber)

  const handleSavedCardSelect = (id: PaymentMethodFormType["savedCard"]) => {
    form.setValue("savedCard", id)
    form.setValue("paymentOption", undefined)
  }

  const handlePaymentOptionSelect = (
    id: PaymentMethodFormType["paymentOption"]
  ) => {
    form.setValue("paymentOption", id)
    form.setValue("savedCard", "")
  }

  function onSubmit(_data: PaymentMethodFormType) {}

  return (
    <Form {...form}>
      <Card asChild>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full p-6 space-y-6"
        >
          {/* Saved Cards */}
          <FormField
            control={form.control}
            name="savedCard"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select from the Saved Cards</FormLabel>
                <FormControl>
                  <RadioGroup value={field.value} className="gap-3 mb-6">
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
                        placeholder="1234 5678 9012 3456"
                        className="ps-9"
                        {...field}
                      />
                    </FormControl>
                    <CreditCardBrandIcon
                      brandName={creditCardName}
                      className="absolute start-3 top-1/2 h-4 w-4"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cardName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cardholder&apos;s Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
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
                        <Input type="number" placeholder="MM/YY" {...field} />
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
                        <Input placeholder="123" {...field} />
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
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Save card for future billing?</FormLabel>
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
                        placeholder="Enter your account number"
                        {...field}
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
                        placeholder="Enter your routing number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="saveCard"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Save card for future billing?</FormLabel>
                    </div>
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
  )
}
