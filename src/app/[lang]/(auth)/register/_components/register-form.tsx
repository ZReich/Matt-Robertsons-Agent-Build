"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
// import { signIn, type SignInResponse } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { SiFacebook, SiGithub, SiGoogle, SiX } from "react-icons/si";

import { getLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Locale } from "@/configs/i18n";

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
  username: z.string().min(3, {
    message: "Usernmae must contain at least 3 character(s)",
  }),
  email: z.string().email(),
  password: z.string().min(8, {
    message: "Password must contain at least 8 character(s)",
  }),
});

interface RegisterFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: Locale;
}

export function RegisterForm({
  className,
  locale,
  ...props
}: RegisterFormProps) {
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });
  const isLoading = form.formState.isLoading;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const { username, email, password } = data;

    try {
      // const res: SignInResponse | undefined = await signIn("credentials", {
      //   email,
      //   password,
      //   redirect: false,
      // });

      // if (res && res.status >= 400) {
      //   throw new Error("Something went wrong!");
      // }

      setTimeout(() => {
        toast({ title: "Login Successful" });
      }, 3000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    } finally {
      router.push("/");
      router.refresh();
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
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="john_doe"
                    className="lowercase"
                    {...field}
                  />
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
          <Button type="submit" disabled={isLoading}>
            {isLoading && <LoaderCircle className="me-2 size-4 animate-spin" />}
            Sign In with Email
          </Button>
        </div>
        <div className="-mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link
            href={getLocalizedPathname("/sign-in", locale)}
            className="underline"
          >
            Sign in
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
