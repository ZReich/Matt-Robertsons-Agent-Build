"use client";

import * as React from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical, ListRestart, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { EmailComposer } from "./email-composer";

const formSchema = z.object({
  to: z.string().email({ message: "Invalid email address" }),
  cc: z.string().email({ message: "Invalid email address" }).optional(),
  bcc: z.string().email({ message: "Invalid email address" }).optional(),
  subject: z
    .string()
    .min(1, { message: "Subject must contain at least 1 character" })
    .max(100, { message: "Subject must contain at most 100 characters" }),
  content: z
    .string()
    .min(1, { message: "Content must contain at least 1 character" })
    .max(5000, { message: "Content must contain at most 5000 characters" }),
});

export function EmailComposerForm() {
  const [showCc, setShowCc] = React.useState(false);
  const [showBcc, setShowBcc] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      content: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {}

  return (
    <Card className="flex-1 w-full md:w-auto">
      <CardHeader className="justify-center">
        <CardTitle>Compose Mail</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-3 space-y-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem className="flex-grow space-y-0">
                      <FormControl>
                        <Input type="email" placeholder="To" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center gap-1.5">
                  <Toggle
                    pressed={showCc}
                    onPressedChange={() => setShowCc(!showCc)}
                  >
                    Cc
                  </Toggle>
                  <Separator orientation="vertical" className="h-4" />
                  <Toggle
                    pressed={showBcc}
                    onPressedChange={() => setShowBcc(!showBcc)}
                  >
                    Bcc
                  </Toggle>
                </div>
              </div>
              {showCc && (
                <FormField
                  control={form.control}
                  name="cc"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="email" placeholder="Cc" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {showBcc && (
                <FormField
                  control={form.control}
                  name="bcc"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="email" placeholder="Bcc" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="text" placeholder="Subject" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <EmailComposer
                        content={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between items-center mt-3 p-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>Save as draft</DropdownMenuItem>
                    <DropdownMenuItem>Add label</DropdownMenuItem>
                    <DropdownMenuItem>Plain text mode</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="reset"
                  variant="ghost"
                  size="icon"
                  onClick={() => form.reset()}
                >
                  <ListRestart className="h-4 w-4" />
                </Button>
              </div>
              <Button type="submit" size="icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
