"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import type { DeleteAccountFormType, UserType } from "../../../types"

import { DeleteAccountSchema } from "../../_schemas/delete-account-schema"

import { Button } from "@/components/ui/button"

export function DeleteAccountForm({ user }: { user: UserType }) {
  const form = useForm<DeleteAccountFormType>({
    resolver: zodResolver(DeleteAccountSchema),
    defaultValues: {
      ...user,
    },
  })

  const { isSubmitting, isValid } = form.formState
  const isDisabled = isSubmitting || !isValid // Disable button if form is invalid or submitting

  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={isDisabled}>
        Disable Account
      </Button>
      <Button variant="destructive" disabled={isDisabled}>
        Delete Account
      </Button>
    </div>
  )
}
