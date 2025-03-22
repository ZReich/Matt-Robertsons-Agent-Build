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

  const { isSubmitting, isDirty } = form.formState
  const isDisabled = isSubmitting || !isDirty // Disable button if form is unchanged or submitting

  function onSubmit(_data: SecurityPreferencesFormType) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-y-3">
        <FormField
          control={form.control}
          name="twoFactorAuth"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Enable 2-Step Authentication</FormLabel>
              </div>
              <FormDescription>
                Add an extra security layer with 2-step authentication for
                better account protection.
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="loginAlerts"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel>Login Alerts</FormLabel>
              </div>
              <FormDescription>
                Receive notifications for login activities to stay informed
                about access to your account.
              </FormDescription>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isDisabled}
          className="mt-2 w-fit"
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
  )
}
