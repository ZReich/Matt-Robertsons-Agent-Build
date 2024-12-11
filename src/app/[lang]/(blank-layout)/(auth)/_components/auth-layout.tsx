"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import type { LocaleType } from "@/configs/i18n";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import Logo from "@/app/icon.svg";

interface AuthProps extends React.HTMLAttributes<HTMLDivElement> {
  imgSrc?: string;
}

const Auth = React.forwardRef<HTMLDivElement, AuthProps>(
  ({ className, children, imgSrc, ...props }, ref) => {
    const params = useParams();
    const locale = params.lang as LocaleType;

    return (
      <div
        ref={ref}
        className={cn(
          "container relative min-h-screen w-full flex px-0 ",
          className
        )}
        {...props}
      >
        <Link
          href={ensureLocalizedPathname("/", locale)}
          className="absolute top-4 start-4 flex text-foreground font-black z-50 hover:text-primary/90"
        >
          <Logo className="size-6" aira-hidden />
          Shadboard
        </Link>
        <div className="w-full max-w-[28rem] m-auto p-8 space-y-6">
          {children}
        </div>
        {imgSrc && <AuthImage imgSrc={imgSrc} />}
      </div>
    );
  }
);
Auth.displayName = "Auth";

interface AuthImageProps extends React.HTMLAttributes<HTMLDivElement> {
  imgSrc: string;
}

const AuthImage = React.forwardRef<HTMLDivElement, AuthImageProps>(
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
        className="object-cover dark:brightness-[0.2] dark:grayscale"
      />
    </div>
  )
);
AuthImage.displayName = "AuthImage";

const AuthHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-2 text-center", className)}
    {...props}
  />
));
AuthHeader.displayName = "AuthHeader";

const AuthTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
AuthTitle.displayName = "AuthTitle";

const AuthDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AuthDescription.displayName = "AuthDescription";

const AuthForm = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
));
AuthForm.displayName = "AuthForm";

const AuthFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("grid gap-6", className)} {...props} />
));
AuthFooter.displayName = "AuthFooter";

export {
  Auth,
  AuthHeader,
  AuthFooter,
  AuthTitle,
  AuthDescription,
  AuthForm,
  AuthImage,
};
