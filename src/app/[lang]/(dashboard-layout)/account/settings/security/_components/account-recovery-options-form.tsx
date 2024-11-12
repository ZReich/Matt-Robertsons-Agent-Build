"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import type { UserType } from "../../../types";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const FormSchema = z.object({
  option: z.enum(["email", "sms", "codes"], {
    required_error: "You need to select an account recovery option.",
  }),
});

interface AccountRecoveryOptionsFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
  user: UserType;
}

export function AccountRecoveryOptionsForm({
  user,
}: AccountRecoveryOptionsFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      option: user.account_reovery_option,
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;

  function onSubmit(data: z.infer<typeof FormSchema>) {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="option"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="rounded-md border p-4 shadow">
                    <div className="flex gap-2">
                      <FormControl>
                        <RadioGroupItem value="email" />
                      </FormControl>
                      <FormLabel className="font-bold">
                        Email Recovery
                      </FormLabel>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Receive a password reset link or recovery instructions
                      sent to your registered email address.
                    </p>
                  </FormItem>
                  <FormItem className="rounded-md border p-4 shadow">
                    <div className="flex gap-2">
                      <FormControl>
                        <RadioGroupItem value="sms" />
                      </FormControl>
                      <FormLabel className="font-bold">SMS Recovery</FormLabel>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Receive a code or recovery instructions via SMS to your
                      registered mobile phone number.
                    </p>
                  </FormItem>
                  <FormItem className="rounded-md border p-4 shadow">
                    <div className="flex gap-2">
                      <FormControl>
                        <RadioGroupItem value="codes" />
                      </FormControl>
                      <FormLabel className="font-bold">
                        Recovery Codes
                      </FormLabel>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use pre-generated recovery codes that you saved when
                      setting up your account to regain access.
                    </p>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-fit"
          disabled={isDisabled}
          aria-live="assertive"
        >
          {isDisabled && (
            <LoaderCircle
              className="me-2 size-4 animate-spin"
              aria-label="Loading"
            />
          )}
          Save
        </Button>
      </form>
    </Form>
  );
}
