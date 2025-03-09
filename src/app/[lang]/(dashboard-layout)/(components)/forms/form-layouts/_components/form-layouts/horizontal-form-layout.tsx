"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { LoaderCircle } from "lucide-react"

import { FormLayoutsSchema } from "../../_schemas/form-layouts-schema"

import type { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { InputPhone } from "@/components/ui/input-phone"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FormType = z.infer<typeof FormLayoutsSchema>

export function HorizontalFormLayout() {
  const form = useForm<FormType>({
    resolver: zodResolver(FormLayoutsSchema),
  })

  const { isSubmitting, isValid, isDirty } = form.formState
  const isDisabled = isSubmitting || !isDirty || !isValid

  async function onSubmit(_data: FormType) {}

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horizontal Form Layout</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>First Name</FormLabel>
                  <FormControl className="col-span-7">
                    <Input type="text" placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>Last Name</FormLabel>
                  <FormControl className="col-span-7">
                    <Input type="text" placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>Username</FormLabel>
                  <FormControl className="col-span-7">
                    <Input type="text" placeholder="john_doe" {...field} />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>Email</FormLabel>
                  <FormControl className="col-span-7">
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl className="col-span-7">
                    <InputPhone placeholder="+123 4567890" {...field} />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="col-span-7">
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="california">California</SelectItem>
                        <SelectItem value="texas">Texas</SelectItem>
                        <SelectItem value="florida">Florida</SelectItem>
                        <SelectItem value="new-york">New York</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>Country</FormLabel>
                  <FormControl className="col-span-7">
                    <Input type="text" placeholder="USA" {...field} />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="grid grid-cols-8 items-center gap-4">
                  <FormLabel>Address</FormLabel>
                  <FormControl className="col-span-7">
                    <Input type="text" placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage className="col-start-2 col-span-7" />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isDisabled} aria-live="assertive">
                {isSubmitting && (
                  <LoaderCircle
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-label="Loading"
                  />
                )}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
