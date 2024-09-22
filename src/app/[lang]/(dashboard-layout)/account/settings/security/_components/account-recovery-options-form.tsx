"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "@/hooks/use-toast";
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
  profile: any;
}

export function AccountRecoveryOptionsForm({
  profile,
}: AccountRecoveryOptionsFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      option: profile.account_reovery_option,
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast({
      title: "You submitted the following values:",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

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
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
