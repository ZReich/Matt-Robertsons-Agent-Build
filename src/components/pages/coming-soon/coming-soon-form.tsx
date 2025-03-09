"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { LoaderCircle } from "lucide-react"

import { ComingSoonSchema } from "@/schemas/coming-soon-schema"

import type { ComingSoonFormType } from "@/types"

import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const defaultValues = { email: "" }

export function ComingSoonForm() {
  const form = useForm<ComingSoonFormType>({
    resolver: zodResolver(ComingSoonSchema),
    defaultValues,
  })

  const { isSubmitting, isValid } = form.formState
  const isDisabled = isSubmitting || !isValid // Disable button if form is invalid or submitting

  async function onSubmit(_data: ComingSoonFormType) {
    form.reset(defaultValues) // Reset the form to the initial state

    toast({
      title: "Thank you for subscribing!",
      description: "We'll notify you when we launch.",
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex gap-x-2 justify-center text-start mb-6"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="shrink-0 w-full space-y-0">
              <FormLabel className="sr-only">Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  className="bg-background"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isDisabled}>
          {isSubmitting && (
            <LoaderCircle className="me-2 size-4 animate-spin" />
          )}
          Notify Me
        </Button>
      </form>
    </Form>
  )
}
