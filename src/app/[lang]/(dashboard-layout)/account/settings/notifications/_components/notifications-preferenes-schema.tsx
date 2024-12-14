"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn, FieldPath } from "react-hook-form";
import { z } from "zod";

import { NotificationPreferencesSchema } from "../_schemas/notifications-preferenes-schema";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FormType = z.infer<typeof NotificationPreferencesSchema>;

export function NotificationPreferencesForm() {
  const form = useForm<FormType>({
    resolver: zodResolver(NotificationPreferencesSchema),
    defaultValues: {
      security: {
        email: true,
        browser: false,
        sms: false,
      },
      communication: {
        email: true,
        browser: false,
        sms: false,
      },
      meetups: {
        email: true,
        browser: false,
        sms: false,
      },
    },
  });

  const { isSubmitting, isValid, isDirty } = form.formState;
  const isDisabled = isSubmitting || !isDirty || !isValid; // Disable button if form is invalid, unchanged, or submitting

  function onSubmit(data: FormType) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="security"
          render={({ field }) => (
            <FormItem className="flex justify-between items-center gap-8">
              <div>
                <FormLabel>Security Notifications</FormLabel>
                <FormDescription>
                  Set preferences for alerts related to account security, such
                  as login attempts and changes.
                </FormDescription>
              </div>
              <FormControl>
                <ChangeButton form={form} field={field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="communication"
          render={({ field }) => (
            <FormItem className="flex justify-between items-center gap-8">
              <div>
                <FormLabel>Communication Notifications</FormLabel>
                <FormDescription>
                  Manage notifications for general communications, including
                  messages and updates.
                </FormDescription>
              </div>
              <FormControl>
                <ChangeButton form={form} field={field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="meetups"
          render={({ field }) => (
            <FormItem className="flex justify-between items-center gap-8">
              <div>
                <FormLabel>Meetups Notifications</FormLabel>
                <FormDescription>
                  Customize notifications for upcoming meetups, events, and
                  related activities.
                </FormDescription>
              </div>
              <FormControl>
                <ChangeButton form={form} field={field} />
              </FormControl>
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
  );
}

interface ChangeButtonProps {
  form: UseFormReturn<z.infer<typeof NotificationPreferencesSchema>>;
  field: {
    name: FieldPath<z.infer<typeof NotificationPreferencesSchema>>;
    value: { email: boolean; browser: boolean; sms: boolean };
  };
}

function ChangeButton({ form, field }: ChangeButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Change</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={field.value.email}
          onCheckedChange={() =>
            form.setValue(
              field.name,
              {
                ...field.value,
                email: !field.value.email,
              },
              { shouldDirty: true }
            )
          }
          className="cursor-pointer"
        >
          Email
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={field.value.browser}
          onCheckedChange={() =>
            form.setValue(
              field.name,
              {
                ...field.value,
                browser: !field.value.browser,
              },
              { shouldDirty: true }
            )
          }
          className="cursor-pointer"
        >
          Browser
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={field.value.sms}
          onCheckedChange={() =>
            form.setValue(
              field.name,
              {
                ...field.value,
                sms: !field.value.sms,
              },
              { shouldDirty: true }
            )
          }
          className="cursor-pointer"
        >
          SMS
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
