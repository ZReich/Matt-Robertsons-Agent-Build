"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import { NewPasswordSchema } from "../_schemas/new-passward-schema";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";

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
import { toast } from "@/hooks/use-toast";

type FormType = z.infer<typeof NewPasswordSchema>;

interface NewPasswordFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
}

export function NewPasswordForm({
  className,
  locale,
  ...props
}: NewPasswordFormProps) {
  const form = useForm<FormType>({
    resolver: zodResolver(NewPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const isLoading = form.formState.isLoading;

  async function onSubmit(data: FormType) {
    try {
      toast({
        title: "Check your email",
        description:
          "We've sent you an email with instructions to reset your password.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
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
          <Button type="submit" disabled={isLoading}>
            {isLoading && <LoaderCircle className="me-2 size-4 animate-spin" />}
            Set new password
          </Button>
        </div>
        <Link
          href={ensureLocalizedPathname("/sign-in", locale)}
          className="-mt-4 text-center text-sm underline"
        >
          Back to Sign in
        </Link>
      </form>
    </Form>
  );
}
