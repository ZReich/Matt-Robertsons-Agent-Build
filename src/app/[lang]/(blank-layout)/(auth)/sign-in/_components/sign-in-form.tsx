"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { SiFacebook, SiGithub, SiGoogle, SiX } from "react-icons/si";

import { userData } from "@/data/user";

import { SignInSchema } from "../_schemas/sign-in-schema";

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
import { SeparatorWithText } from "@/components/ui/separator";

type FormType = z.infer<typeof SignInSchema>;

interface SignInFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
}

export function SignInForm({ className, locale, ...props }: SignInFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectPathname = searchParams.get("redirectTo") ?? "/";

  const form = useForm<FormType>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: userData.email,
      password: userData.password,
    },
  });
  const isLoading = form.formState.isLoading;

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

      router.push(redirectPathname);
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("grid gap-6", className)}
        {...props}
      >
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
                    href={ensureLocalizedPathname("/forgot-password", locale)}
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
          <Button type="submit" disabled={isLoading}>
            {isLoading && <LoaderCircle className="me-2 size-4 animate-spin" />}
            Sign In with Email
          </Button>
        </div>
        <div className="-mt-4 text-center text-sm">
          Don&apos;t have an account?
          <Link
            href={ensureLocalizedPathname("/register", locale)}
            className="underline"
          >
            Sign up
          </Link>
        </div>
        <SeparatorWithText>Or continue with</SeparatorWithText>
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/facebook" aria-label="Facebook">
              <SiFacebook className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/github" aria-label="GitHub">
              <SiGithub className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/google" aria-label="Google">
              <SiGoogle className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/x" aria-label="X">
              <SiX className="size-4" />
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
