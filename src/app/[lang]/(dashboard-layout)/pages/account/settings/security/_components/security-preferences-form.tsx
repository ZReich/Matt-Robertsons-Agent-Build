"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { LoaderCircle } from "lucide-react"

import type { SecurityPreferencesFormType, UserType } from "../../../types"

import { SecurityPreferencesSchema } from "../_schemas/security-preferences-form-schema"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"

interface SecurityPreferencesFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
  user: UserType
}

export function SecurityPreferencesForm({
  user,
}: SecurityPreferencesFormProps) {
  const form = useForm<SecurityPreferencesFormType>({
    resolver: zodResolver(SecurityPreferencesSchema),
    defaultValues: {
      twoFactorAuth: user.twoFactorAuth,
      loginAlerts: user.loginAlerts,
    },
  })

  const { isSubmitting, isValid, isDirty } = form.formState
  const isDisabled = isSubmitting || !isDirty || !isValid // Disable button if form is invalid, unchanged, or submitting

  function onSubmit(_data: SecurityPreferencesFormType) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-3">
          <FormField
            control={form.control}
            name="twoFactorAuth"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Enable 2-Step Authentication</FormLabel>
                  <FormDescription>
                    Add an extra security layer with 2-step authentication for
                    better account protection.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="loginAlerts"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Login Alerts</FormLabel>
                  <FormDescription>
                    Receive notifications for login activities to stay informed
                    about access to your account.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
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
