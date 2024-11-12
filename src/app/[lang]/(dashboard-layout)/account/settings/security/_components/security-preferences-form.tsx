"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import type { UserType } from "../../../types";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

const FormSchema = z.object({
  two_factor_auth: z.boolean().default(false).optional(),
  login_alerts: z.boolean().default(true).optional(),
});

interface SecurityPreferencesFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
  user: UserType;
}

export function SecurityPreferencesForm({
  user,
}: SecurityPreferencesFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      two_factor_auth: user.two_factor_auth,
      login_alerts: user.login_alerts,
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;

  function onSubmit(data: z.infer<typeof FormSchema>) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-3">
          <FormField
            control={form.control}
            name="two_factor_auth"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
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
            name="login_alerts"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
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
  );
}
