import Image from "next/image"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export function LandingHero() {
  return (
    <section className="container my-0 space-y-3 overflow-hidden md:px-8">
      <div className="grid place-items-center text-center space-y-3">
        <h1 className="text-4xl font-black">Build Faster with Shadboard</h1>
        <p className="max-w-prose w-full text-lg text-muted-foreground">
          A robust admin template built with React, Next.js, and Tailwind CSS
          designed for seamless customization and reliable performance.
        </p>
        <div className="flex gap-x-2">
          <Link
            href="/dashboards/analytics"
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
      <LandingHeroImage />
    </section>
  )
}

function LandingHeroImage() {
  return (
    <div className="px-13 pt-13 [mask-image:linear-gradient(to_bottom,white,transparent_75%)]">
      <div className="pointer-events-none aspect-16/7 relative rounded-lg before:absolute before:inset-0 before:shadow-2xl before:shadow-primary">
        <Image
          src="/images/misc/hero.png"
          alt=""
          fill
          sizes="(max-width: 768px) 640px, 1080px"
          priority
          className="block border border-border rounded-lg object-cover object-top dark:hidden"
        />
        <Image
          src="/images/misc/hero-dark.png"
          alt=""
          fill
          sizes="(max-width: 768px) 640px, 1080px"
          priority
          className="hidden border border-border rounded-lg object-cover object-top dark:block"
        />
      </div>
    </div>
  )
}
