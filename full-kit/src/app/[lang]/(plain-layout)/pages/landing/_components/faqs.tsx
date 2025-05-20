"use client"

import Image from "next/image"
import Link from "next/link"

import { FaqsList } from "./faqs-list"

export function Faqs() {
  return (
    <section id="faqs" className="container grid gap-8 md:grid-cols-3">
      <div className="mx-auto text-center md:text-start">
        <h1 className="text-3xl font-semibold">Frequently Asked Questions</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Explore answers to common questions. If you need further assistance,{" "}
          <Link
            href="/pages/landing#contact-us"
            className="font-black underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            get in touch
          </Link>
          .
        </p>
        <Image
          src="/images/illustrations/characters/character-04.svg"
          alt=""
          width={363}
          height={504}
          className="h-80 hidden mt-3 mx-auto md:block"
        />
      </div>
      <FaqsList />
    </section>
  )
}
