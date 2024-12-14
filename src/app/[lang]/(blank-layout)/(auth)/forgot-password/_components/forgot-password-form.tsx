"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import { ForgotPasswordSchema } from "../_schemas/forgot-passward-schema";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn, ensureRedirectPathname } from "@/lib/utils";

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

type FormType = z.infer<typeof ForgotPasswordSchema>;

interface ForgotPasswordFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
}

export function ForgotPasswordForm({
  className,
  locale,
  ...props
}: ForgotPasswordFormProps) {
  const searchParams = useSearchParams();

  const redirectPathname = searchParams.get("redirectTo");

  const form = useForm<FormType>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const { isSubmitting, isValid, isDirty } = form.formState;
  const isDisabled = isSubmitting || !isDirty || !isValid; // Disable button if form is invalid, unchanged, or submitting

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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
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
            Send instructions
          </Button>
        </div>
        <Link
          href={ensureLocalizedPathname(
            // Include redirect pathname if available, otherwise default to "/sign-in"
            redirectPathname
              ? ensureRedirectPathname("/sign-in", redirectPathname)
              : "/sign-in",
            locale
          )}
          className="-mt-4 text-center text-sm underline"
        >
          Back to Sign in
        </Link>
      </form>
    </Form>
  );
}
