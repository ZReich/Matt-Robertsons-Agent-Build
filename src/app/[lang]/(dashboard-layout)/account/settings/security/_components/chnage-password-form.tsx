"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { UserType } from "../../../types";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const FormSchema = z.object({
  current_password: z.string().min(8, {
    message: "Current password must contain at least 8 character(s)",
  }),
  new_password: z.string().min(8, {
    message: "New password must contain at least 8 character(s)",
  }),
  confirm_password: z.string().min(8, {
    message: "Confirm password must contain at least 8 character(s)",
  }),
});

interface ChangePasswordFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
  user: UserType;
}

export function ChangePasswordForm({
  className,
  user,
  ...props
}: ChangePasswordFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;

  async function onSubmit(data: z.infer<typeof FormSchema>) {}

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("grid gap-6", className)}
        {...props}
      >
        <div className="grid gap-2">
          <FormField
            control={form.control}
            name="current_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="new_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="mt-2 w-fit"
            disabled={isDisabled}
            aria-live="assertive"
          >
            {isSubmitting && (
              <LoaderCircle
                className="me-2 size-4 animate-spin"
                aria-label="Loading"
              />
            )}
            Set new password
          </Button>
        </div>
      </form>
    </Form>
  );
}
