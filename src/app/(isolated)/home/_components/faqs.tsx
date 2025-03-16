"use client"

import * as React from "react"
import Link from "next/link"

import { FaqsList } from "./faqs-list"

export function Faqs() {
  return (
    <section
      id="faqs"
      className="container relative grid gap-6 p-4 py-16 md:grid-cols-3"
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full fill-muted-foreground -z-10 [mask-image:radial-gradient(closest-side,white,transparent)]"
      >
        <defs>
          <pattern
            id="dot-patter"
            width={16}
            height={16}
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
            x={0}
            y={0}
          >
            <circle id="pattern-circle" cx={1} cy={1} r={1} />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill="url(#dot-patter)"
        />
      </svg>
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
