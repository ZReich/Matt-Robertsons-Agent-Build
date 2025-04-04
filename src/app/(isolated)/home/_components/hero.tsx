import Image from "next/image"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { TypeWriterEffect } from "../../_components/type-writer-effect"

const words = [
  "Accessible",
  "Scalable",
  "Content Rich",
  "Customizable",
  "Flexible",
  "Efficient",
  "Responsive",
  "Well-Documented",
]

export function Hero() {
  return (
    <section className="container my-0 space-y-6 overflow-hidden md:px-8">
      <div className="grid place-items-center text-center space-y-6">
        <h1 className="text-3xl font-semibold">
          Build Faster with {""}
          <br className="min-[560px]:hidden" />
          <span className="[&>span]:first:text-primary">
            <TypeWriterEffect textArray={words} />
          </span>
        </h1>
        <p className="max-w-[50ch] w-full text-lg">
          A robust admin template built with React, Next.js, and Tailwind CSS
          designed for seamless customization and reliable performance.
        </p>
        <div className="flex gap-x-2">
          <Link
            href="https://shadboard.vercel.app/dashboards/analytics"
            className={buttonVariants({ size: "lg" })}
          >
            Demo
          </Link>
          <Link
            href="/docs"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Documentation
          </Link>
        </div>
      </div>
      <div className="px-10 pt-10 [mask-image:linear-gradient(to_bottom,white,transparent_75%)]">
        <div className="pointer-events-none aspect-16/7 relative rounded-lg before:absolute before:inset-0 before:shadow-2xl before:shadow-primary before:animate-pulse">
          <Image
            src="/images/misc/hero.jpg"
            alt=""
            fill
            sizes="(max-width: 768px) 640px, 1080px"
            priority
            className="block border border-border rounded-lg object-cover object-top dark:hidden"
          />
          <Image
            src="/images/misc/hero-dark.jpg"
            alt=""
            fill
            sizes="(max-width: 768px) 640px, 1080px"
            priority
            className="hidden border border-border rounded-lg object-cover object-top dark:block"
          />
        </div>
      </div>
    </section>
  )
}
