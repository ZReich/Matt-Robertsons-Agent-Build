"use client"

import { signOut } from "next-auth/react"

import { Button } from "@/components/ui/button"

export function ContactCandidateSignOutButton({
  callbackUrl,
}: {
  callbackUrl: string
}) {
  return <Button onClick={() => signOut({ callbackUrl })}>Sign out</Button>
}
