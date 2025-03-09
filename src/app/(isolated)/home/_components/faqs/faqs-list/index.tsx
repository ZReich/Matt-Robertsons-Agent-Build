"use client"

import * as React from "react"

import { faqsData } from "../../../_data/faqs"

import { Accordion } from "@/components/ui/accordion"
import { FaqsItem } from "./faqs-item"

export function FaqsList() {
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full rounded-lg border bg-card text-card-foreground p-6 md:col-span-2"
    >
      {faqsData.map((faq) => (
        <FaqsItem key={faq.question} faq={faq} />
      ))}
    </Accordion>
  )
}
