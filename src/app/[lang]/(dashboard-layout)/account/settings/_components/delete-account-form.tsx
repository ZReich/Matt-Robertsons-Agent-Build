"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DeleteAccountSchema } from "../_schemas/delete-account-schema";

import type { LocaleType } from "@/configs/i18n";
import type { UserType } from "../../types";

import { Button } from "@/components/ui/button";

type FormType = z.infer<typeof DeleteAccountSchema>;

interface DeleteAccountFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: LocaleType;
  user: UserType;
}

export function DeleteAccountForm({
  className,
  locale,
  user,
  ...props
}: DeleteAccountFormProps) {
  const form = useForm<FormType>({
    resolver: zodResolver(DeleteAccountSchema),
    defaultValues: {
      ...user,
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid; // Disable button if form is invalid or submitting

  async function onSubmit(data: FormType) {}

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
