"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";

import { Locale } from "@/configs/i18n";

import { Button } from "@/components/ui/button";

const FormSchema = z.object({});

interface DeleteAccountFormProps extends React.HTMLAttributes<HTMLFormElement> {
  locale: Locale;
  profile: any;
}

export function DeleteAccountForm({
  className,
  locale,
  profile,
  ...props
}: DeleteAccountFormProps) {
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...profile,
    },
  });

  const isLoading = form.formState.isSubmitting;

  async function onSubmit(data: z.infer<typeof FormSchema>) {}

  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={isLoading}>
        Disable Account
      </Button>
      <Button variant="destructive" disabled={isLoading}>
        Delete Account
      </Button>
    </div>
  );
}
