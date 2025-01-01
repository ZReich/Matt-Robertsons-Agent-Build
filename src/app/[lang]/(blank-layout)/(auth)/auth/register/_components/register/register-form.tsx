"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { RegisterSchema } from "../../_schemas/register-schema";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { ensureRedirectPathname } from "@/lib/utils";

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
import { SeparatorWithText } from "@/components/ui/separator";
import { OAuthLinks } from "../../../_components/oauth-links";

type FormType = z.infer<typeof RegisterSchema>;

export function RegisterForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const form = useForm<FormType>({
    resolver: zodResolver(RegisterSchema),
  });

  const locale = params.lang as LocaleType;
  const redirectPathname = searchParams.get("redirectTo");
  const { isSubmitting, isValid, isDirty } = form.formState;
  const isDisabled = isSubmitting || !isDirty || !isValid; // Disable button if form is invalid, unchanged, or submitting

  async function onSubmit(data: FormType) {
    const { firstName, lastName, username, email, password } = data;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          email,
          password,
        }),
      });

      if (res && res.status >= 400) {
        const {
          issues,
          message,
        }: {
          issues?: { path: (keyof FormType)[]; message: string }[];
          message?: string;
        } = await res.json();

        if (!issues) throw new Error(message ?? "An unknown error occurred.");

        // Set errors in React Hook Form based on server response
        issues.forEach((issue) => {
          const field = issue.path[0];
          form.setError(field, { type: "manual", message: issue.message });
        });
      } else {
        toast({ title: "Register Successful" });
        router.push(
          ensureLocalizedPathname(
            // Include redirect pathname if available, otherwise default to "/sign-in"
            redirectPathname
              ? ensureRedirectPathname("/auth/sign-in", redirectPathname)
              : "/auth/sign-in",
            locale
          )
        );
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Register Failed",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <div className="grid gap-2">
          <div className="flex justify-between gap-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="john_doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <Button type="submit" disabled={isDisabled} aria-live="assertive">
            {isSubmitting && (
              <LoaderCircle
                className="me-2 size-4 animate-spin"
                aria-label="Loading"
              />
            )}
            Sign In with Email
          </Button>
        </div>
        <div className="-mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link
            href={ensureLocalizedPathname(
              // Include redirect pathname if available, otherwise default to "/sign-in"
              redirectPathname
                ? ensureRedirectPathname("/auth/sign-in", redirectPathname)
                : "/auth/sign-in",
              locale
            )}
            className="underline"
          >
            Sign in
          </Link>
        </div>
        <SeparatorWithText>Or continue with</SeparatorWithText>
        <OAuthLinks />
      </form>
    </Form>
  );
}
