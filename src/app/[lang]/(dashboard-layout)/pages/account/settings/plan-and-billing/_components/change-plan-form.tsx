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

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
                Toggle if you want to select nnual
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem className="space-y-3">
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
                        <FormControl className="absolute top-4 end-4">
                          <RadioGroupItem value={plan.name} />
                        </FormControl>
                        <FormLabel className="cursor-pointer h-full">
                          <Card
                            className={cn(
                              "h-full",
                              field.value === plan.name && "border-primary" // Highlight the selected price
                            )}
                            aria-current={
                              field.value === plan.name ? "true" : undefined
                            }
                          >
                            <CardHeader>
                              <CardTitle>{plan.name}</CardTitle>
                              <CardDescription>
                                {formattedPrice}
                                /month
                                {isAnnual && (
                                  <span className="me-2 text-success">
                                    Save {formattedPrice}
                                    /month
                                  </span>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc ps-4 space-y-1">
                                {plan.features.map((feature, index) => (
                                  <li
                                    key={`${feature}-${index}`}
                                    className="text-sm"
                                  >
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
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
