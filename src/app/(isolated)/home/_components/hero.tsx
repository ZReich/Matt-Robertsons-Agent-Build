import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { TypeWriterEffect } from "../../_components/type-writer-effect";

const words = [
  "Accessible",
  "Scalable",
  "Content Rich",
  "Customizable",
  "Flexible",
  "Efficient",
  "Responsive",
  "Well-Documented",
];

export function Hero() {
  return (
    <section className="container relative p-8 !pb-0 space-y-16 overflow-hidden md:p-16">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-1/2 w-full fill-muted-foreground -z-10 [mask-image:radial-gradient(closest-side,white,transparent)] md:[mask-size:50%]"
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
      <div className="grid place-items-center text-center space-y-6">
        <h1 className="text-3xl font-semibold">
          Build Faster with {""}
          <br className="min-[560px]:hidden" />
          <TypeWriterEffect textArray={words} />
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
      <div className="pointer-events-none aspect-[16/7] relative [mask-image:linear-gradient(to_bottom,white,transparent_75%)]">
        <Image
          src="/images/hero.jpg"
          alt=""
          fill
          sizes="(max-width: 768px) 640px, 1080px"
          priority
          className="border border-border rounded-lg object-cover object-top"
        />
      </div>
    </section>
  );
}
