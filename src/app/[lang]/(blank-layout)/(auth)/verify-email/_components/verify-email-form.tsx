"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Form,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

const FormSchema = z.object({
  email: z.string().email(),
});

interface VerifyEmailFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
}

export function VerifyEmailForm({
  className,
  locale,
  ...props
}: VerifyEmailFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to send verification email");
      }

      toast({
        title: "Check your email",
        description:
          "We've sent you an email with instructions to verify your email address.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("grid", className)}
        {...props}
      >
        <Link
          href={ensureLocalizedPathname("/", locale)}
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Skip for now
        </Link>
        <div className="text-center text-sm">
          Didn&apos;t receive the email?{" "}
          <Button
            type="submit"
            variant="link"
            className="underline underline-offset-0 p-0"
          >
            Resend
          </Button>
        </div>
      </form>
    </Form>
  );
}
