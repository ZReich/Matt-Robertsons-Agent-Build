"use client"

import Link from "next/link"

import { FaqsList } from "./faqs-list"

export function Faqs() {
  return (
    <section id="faqs" className="container grid gap-8 md:grid-cols-3">
      <div className="space-y-6 text-center md:cols-span-1 md:text-start">
        <h1 className="text-2xl font-semibold">Frequently asked questions</h1>
        <p className="max-w-prose mx-auto">
          Explore answers to common questions. If you need further assistance,{" "}
          <Link
            href="/contact-us"
            className="font-semibold underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            get in touch
          </Link>
          .
        </p>
      </div>
      <FaqsList />
    </section>
  )
}
