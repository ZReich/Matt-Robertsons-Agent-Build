"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Locale } from "@/configs/i18n";
import type { UserType } from "../../types";

import { Button } from "@/components/ui/button";

const FormSchema = z.object({});

interface DeleteAccountFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: Locale;
  user: UserType;
}

export function DeleteAccountForm({
  className,
  locale,
  user,
  ...props
}: DeleteAccountFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...user,
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;

  async function onSubmit(data: z.infer<typeof FormSchema>) {}

  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={isDisabled}>
        Disable Account
      </Button>
      <Button variant="destructive" disabled={isDisabled}>
        Delete Account
      </Button>
    </div>
  );
}
