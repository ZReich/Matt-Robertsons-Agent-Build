"use client"

import { forwardRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"

import type { LocaleType } from "@/types"
import type { HTMLAttributes } from "react"

import { ensureLocalizedPathname } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface AuthProps extends HTMLAttributes<HTMLDivElement> {
  imgSrc?: string
  imgClassName?: string
}

const Auth = forwardRef<HTMLDivElement, AuthProps>(
  ({ className, children, imgSrc, imgClassName, ...props }, ref) => {
    const params = useParams()
    const locale = params.lang as LocaleType

    return (
      <section
        ref={ref}
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
)
Auth.displayName = "Auth"

interface AuthImageProps extends HTMLAttributes<HTMLDivElement> {
  imgSrc: string
}

const AuthImage = forwardRef<HTMLDivElement, AuthImageProps>(
  ({ className, imgSrc, ...props }, ref) => (
    <div
      ref={ref}
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
        className="object-cover"
      />
    </div>
  )
)
AuthImage.displayName = "AuthImage"

const AuthHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("space-y-2 text-center", className)}
      {...props}
    />
  )
)
AuthHeader.displayName = "AuthHeader"

const AuthTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
AuthTitle.displayName = "AuthTitle"

const AuthDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AuthDescription.displayName = "AuthDescription"

const AuthForm = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={className} {...props} />
  )
)
AuthForm.displayName = "AuthForm"

const AuthFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("grid gap-6", className)} {...props} />
  )
)
AuthFooter.displayName = "AuthFooter"

export {
  Auth,
  AuthHeader,
  AuthFooter,
  AuthTitle,
  AuthDescription,
  AuthForm,
  AuthImage,
}
