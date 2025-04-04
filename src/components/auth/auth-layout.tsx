"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"

import type { LocaleType } from "@/types"
import type { ComponentProps } from "react"

import { ensureLocalizedPathname } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface AuthProps extends ComponentProps<"div"> {
  imgSrc?: string
  imgClassName?: string
}

export function Auth({
  className,
  children,
  imgSrc,
  imgClassName,
  ...props
}: AuthProps) {
  const params = useParams()
  const locale = params.lang as LocaleType

  return (
    <section
      className={cn(
        "container relative min-h-screen w-full flex px-0",
        className
      )}
      {...props}
    >
      <Link
        href={ensureLocalizedPathname("/", locale)}
        className="absolute top-4 start-4 flex text-foreground font-black z-50 hover:text-primary/90"
      >
        <Image
          src="/images/icons/shadboard.svg"
          alt=""
          height={24}
          width={24}
          className="dark:invert"
        />
        <span>Shadboard</span>
      </Link>
      <div className="w-full max-w-[28rem] m-auto px-6 py-12 space-y-6">
        {children}
      </div>
      {imgSrc && <AuthImage imgSrc={imgSrc} className={imgClassName} />}
    </section>
  )
}

interface AuthImageProps extends ComponentProps<"div"> {
  imgSrc: string
}

export function AuthImage({ className, imgSrc, ...props }: AuthImageProps) {
  return (
    <div
      className={cn(
        "relative hidden min-h-screen w-1/2 bg-muted md:block",
        className
      )}
      {...props}
    >
      <Image
        src={imgSrc}
        alt="Image"
        fill
        sizes="(max-width: 1200px) 60vw, 38vw"
        priority
        className="object-cover"
      />
    </div>
  )
}

export function AuthHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-2 text-center", className)} {...props} />
}

export function AuthTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

export function AuthDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
}

export function AuthForm({ className, ...props }: ComponentProps<"div">) {
  return <div className={className} {...props} />
}

export function AuthFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid gap-6", className)} {...props} />
}
