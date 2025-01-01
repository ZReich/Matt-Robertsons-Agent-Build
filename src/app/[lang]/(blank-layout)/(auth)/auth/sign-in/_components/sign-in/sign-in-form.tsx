"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { userData } from "@/data/user";

import { SignInSchema } from "../../_schemas/sign-in-schema";

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

type FormType = z.infer<typeof SignInSchema>;

export function SignInForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectPathname = searchParams.get("redirectTo");

  const form = useForm<FormType>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: userData.email,
      password: userData.password,
    },
  });

  const locale = params.lang as LocaleType;
  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid; // Disable button if form is invalid, or submitting

  async function onSubmit(data: FormType) {
    const { email, password } = data;

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result && result.error) {
        throw new Error(result.error);
      }

      router.push(redirectPathname ?? "/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign In Failed",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <div className="grid grow gap-2">
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
                <div className="flex items-center">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href={ensureLocalizedPathname(
                      // Include redirect pathname if available, otherwise default to "/forgot-password"
                      redirectPathname
                        ? ensureRedirectPathname(
                            "/auth/forgot-password",
                            redirectPathname
                          )
                        : "/auth/forgot-password",
                      locale
                    )}
                    className="ms-auto inline-block text-sm underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
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
          Don&apos;t have an account?{" "}
          <Link
            href={ensureLocalizedPathname(
              // Include redirect pathname if available, otherwise default to "/auth/register"
              redirectPathname
                ? ensureRedirectPathname("/auth/register", redirectPathname)
                : "/auth/register",
              locale
            )}
            className="underline"
          >
            Sign up
          </Link>
        </div>
        <SeparatorWithText>Or continue with</SeparatorWithText>
        <OAuthLinks />
      </form>
    </Form>
  );
}
