"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { LoaderCircle } from "lucide-react"

import type {
  ChangePlanFormType,
  PlanType,
  SubscriptionType,
} from "../../../types"

import { ChangePlanSchema } from "../_schemas/change-plan-schema"

import { cn, formatCurrency, getDiscountedPrice } from "@/lib/utils"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"

export function ChangePlanForm({
  plans,
  subscriptions,
}: {
  plans: PlanType[]
  subscriptions: SubscriptionType[]
}) {
  const lastSubscribedPlan = plans.find((p) => p.id === subscriptions[0].planId)

  const form = useForm<ChangePlanFormType>({
    resolver: zodResolver(ChangePlanSchema),
    defaultValues: {
      plan: lastSubscribedPlan?.name,
      isAnnual: subscriptions[0].interval === "yearly",
    },
  })

  const isAnnual = form.watch("isAnnual")
  const { isSubmitting, isValid, isDirty } = form.formState
  const isDisabled = isSubmitting || !isDirty || !isValid // Disable button if form is invalid, unchanged, or submitting

  function onSubmit(_data: ChangePlanFormType) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="isAnnual"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-x-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Annual billing (Save 15%)</FormLabel>
              </div>
              <FormDescription>
                Toggle if you want to select annual
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem className="space-y-3">
              {/* <FormLabel
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 w-full justify-start gap-x-2 cursor-pointer"
                )}
              ></FormLabel> */}
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid gap-2"
                >
                  {/* Render a card for each plan */}
                  {plans.map((plan) => {
                    const price = isAnnual
                      ? getDiscountedPrice(plan.price, 0.85, true) // Discounted monthly price for annual billing
                      : plan.price
                    const formattedPrice = formatCurrency(price)

                    return (
                      <FormItem key={plan.name} className="relative">
                        <FormLabel
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-auto w-full flex-col justify-start items-start gap-2 p-4 cursor-pointer"
                          )}
                        >
                          <div className="flex items-center gap-x-2">
                            <FormControl>
                              <RadioGroupItem value={plan.name} />
                            </FormControl>
                            <span>
                              {plan.name} {formattedPrice}/month
                            </span>
                          </div>
                          <ul className="text-muted-foreground list-disc ms-5">
                            {plan.features.map((feature, index) => (
                              <li key={`${feature}-${index}`}>{feature}</li>
                            ))}
                          </ul>
                        </FormLabel>
                      </FormItem>
                    )
                  })}
                </RadioGroup>
              </FormControl>
              <FormDescription>
                Select your desired plan by clicking on its card
              </FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isDisabled} aria-live="assertive">
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
  )
}
