"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";

import { getEmailsBySearchTermData } from "../_actions/get-emails-by-search-term-data";

import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";

const formSchema = z.object({
  term: z
    .string()
    .max(100, { message: "Search term must contain at most 100 characters" }),
});

interface EmailListSearchFormProps {
  pageQuery: number;
  filterParam: string;
  setEmailState: (data: any) => void;
}

export function EmailListSearchForm({
  pageQuery,
  filterParam,
  setEmailState,
}: EmailListSearchFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      term: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const newEmailsData = await getEmailsBySearchTermData(
      pageQuery,
      filterParam,
      data.term
    );

    if (newEmailsData) setEmailState(newEmailsData);
  };

  return (
    <Form {...form}>
      <form onChange={form.handleSubmit(onSubmit)} className="grow">
        <FormField
          control={form.control}
          name="term"
          render={({ field }) => (
            <FormItem className="relative space-y-0">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
              <FormControl>
                <Input
                  className="w-full shadow-none ps-8 pe-4"
                  placeholder="Search..."
                  type="search"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
