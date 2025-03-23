"use client"

import { useParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Send } from "lucide-react"

import type { LocaleType } from "@/types"
import type { TextMessageFormType } from "../types"

import { TextMessageSchema } from "../_schemas/text-message-schema"

import { useChatContext } from "../_hooks/use-chat-context"
import { ButtonLoading } from "@/components/ui/button"
import { EmojiPicker } from "@/components/ui/emoji-picker"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

export function TextMessageForm() {
  const params = useParams()
  const { handleAddTextMessage } = useChatContext()
  const form = useForm<TextMessageFormType>({
    resolver: zodResolver(TextMessageSchema),
    defaultValues: {
      text: "",
    },
  })

  const text = form.watch("text")
  const { isSubmitting, isValid } = form.formState
  const isDisabled = isSubmitting || !isValid // Disable button if form is invalid or submitting
  const locale = params.lang as LocaleType

  const onSubmit = async (data: TextMessageFormType) => {
    handleAddTextMessage(data.text)
    form.reset() // Reset the form to the initial state
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full flex justify-center items-center gap-1.5"
      >
        <EmojiPicker
          locale={locale}
          onEmojiSelect={(e) => {
            form.setValue("text", text + e.native)
            form.trigger()
          }}
        />

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem className="grow space-y-0">
              <FormLabel className="sr-only">Type a message</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Type a message..."
                  autoComplete="off"
                  className="bg-accent"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <ButtonLoading
          isLoading={isSubmitting}
          disabled={isDisabled}
          size="icon"
          icon={Send}
          iconClassName="me-0"
          loadingIconClassName="me-0"
        >
          Save
        </ButtonLoading>
      </form>
    </Form>
  )
}
