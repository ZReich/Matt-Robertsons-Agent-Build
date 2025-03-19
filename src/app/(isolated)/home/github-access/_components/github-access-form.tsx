"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { LoaderCircle } from "lucide-react"

import type { z } from "zod"
import type { GitHubAccessType } from "../types"

import { GitHubAccessSchema } from "../_schemas/github-access-schema"

import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

type FlattenedErrorType = z.typeToFlattenedError<GitHubAccessType, string>
type FieldErrorType = keyof FlattenedErrorType["fieldErrors"]

export function GitHubAccessForm() {
  const form = useForm<GitHubAccessType>({
    resolver: zodResolver(GitHubAccessSchema),
    defaultValues: {
      name: "",
      email: "",
      purchaseCode: "",
      gitHubUsername: "",
      repository: "shadboard-nextjs",
    },
  })

  const { isSubmitting, isValid } = form.formState
  const isDisabled = isSubmitting || !isValid // Disable button if form is invalid, or submitting

  async function onSubmit(data: GitHubAccessType) {
    try {
      const res = await fetch("/api/github-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (res.status >= 400) {
        const errorRes = await res.json()

        if (errorRes.formErrors) {
          const { fieldErrors }: FlattenedErrorType = errorRes.formErrors

          Object.entries(fieldErrors).forEach(([name, messages]) => {
            form.setError(name as FieldErrorType, {
              type: "manual",
              message: messages[0],
            })
          })

          toast({
            variant: "destructive",
            title: "Validation Errors",
          })
        }
        if (errorRes.message) {
          throw new Error(errorRes.message)
        }

        throw new Error("Failed to send GitHub access request.")
      }

      toast({
        title: "Success",
        description: "GitHub Access Request sent successfully!",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed",
        description:
          error instanceof Error ? error.message : "Something went wrong.",
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <FormField
          control={form.control}
          name="purchaseCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase Code</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input type="text" placeholder="John Doe" {...field} />
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
                <Input type="email" placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gitHubUsername"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GitHub Username</FormLabel>
              <FormControl>
                <Input type="text" placeholder="john-doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="repository"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repository</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="repository-name"
                  disabled
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isDisabled} aria-live="assertive">
          {isSubmitting && (
            <LoaderCircle
              className="me-2 size-4 animate-spin"
              aria-label="Loading"
            />
          )}
          Submit
        </Button>
      </form>
    </Form>
  )
}
