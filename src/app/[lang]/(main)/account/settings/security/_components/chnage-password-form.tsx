"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

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

interface ChangePasswordFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
  locale: Locale;
  profile: any;
}

export function ChangePasswordForm({
  className,
  locale,
  profile,
  ...props
}: ChangePasswordFormProps) {
  const FormSchema = z
    .object({
      current_password: z.string().min(8, {
        message: "Current password must contain at least 8 character(s)",
      }),
      new_password: z.string().min(8, {
        message: "New password must contain at least 8 character(s)",
      }),
      confirm_password: z.string().min(8, {
        message: "Confirm password must contain at least 8 character(s)",
      }),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: "Passwords must match",
      path: ["confirm_password"],
    })
    .refine((data) => data.current_password !== data.new_password, {
      message: "Password must be different",
      path: ["new_password"],
    })
    .refine((data) => data.current_password !== profile.password, {
      message: "Current password is incorrect",
      path: ["current_password"],
    });

  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const isLoading = form.formState.isLoading;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      console.log(data);
      toast({
        title: "Check your email",
        description:
          "We've sent you an email with instructions to reset your password.",
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
          <Button type="submit" className="mt-2 w-fit" disabled={isLoading}>
            {isLoading && <LoaderCircle className="me-2 size-4 animate-spin" />}
            Set new password
          </Button>
        </div>
      </form>
    </Form>
  );
}
