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

const FormSchema = z.object({
  email: z
    .string()
    .email()
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, {
      message: "Password must contain at least 8 character(s)",
    })
    .regex(/(?=.*[a-zA-Z])/, {
      message: "Password must contain at least one letter.",
    })
    .regex(/(?=.*[0-9])/, {
      message: "Password must contain at least one number.",
    }),
});

type FormType = z.infer<typeof FormSchema>;

interface SignInFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
}

export function SignInForm({ className, locale, ...props }: SignInFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectPathname = searchParams.get("redirectTo") ?? "/";

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
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
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Sign In Failed",
        description:
          e instanceof Error ? e.message : "An unknown error occurred.",
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
            <Link href="/api/auth/facebook">
              <SiFacebook className="size-4" />
              <span className="sr-only">Facebook</span>
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/github">
              <SiGithub className="size-4" />
              <span className="sr-only">GitHub</span>
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/google">
              <SiGoogle className="size-4" />
              <span className="sr-only">Google</span>
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href="/api/auth/x">
              <SiX className="size-4" />
              <span className="sr-only">X</span>
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
