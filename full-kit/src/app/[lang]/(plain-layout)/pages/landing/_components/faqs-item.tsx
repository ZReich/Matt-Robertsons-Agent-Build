"use client"

import type { FaqType } from "../types"

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function FaqsItem({ faq }: { faq: FaqType }) {
  return (
    <AccordionItem value={faq.question}>
      <AccordionTrigger className="text-start font-semibold">
        {faq.question}
      </AccordionTrigger>
      <AccordionContent>{faq.answer}</AccordionContent>
    </AccordionItem>
  )
}
