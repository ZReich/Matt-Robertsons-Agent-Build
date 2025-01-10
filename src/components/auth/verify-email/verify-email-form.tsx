"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { VerifyEmailSchema } from "@/schemas/verify-email-schema";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { LocaleType } from "@/types";

import { Button, buttonVariants } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

type FormType = z.infer<typeof VerifyEmailSchema>;

export function VerifyEmailForm() {
  const params = useParams();
  const form = useForm<FormType>({
    resolver: zodResolver(VerifyEmailSchema),
    defaultValues: {
      email: "",
    },
  });

  const locale = params.lang as LocaleType;

  async function onSubmit(data: FormType) {
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid">
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
