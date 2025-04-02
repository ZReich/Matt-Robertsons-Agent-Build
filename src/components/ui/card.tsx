import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

export interface CardProps extends React.ComponentProps<"div"> {
  asChild?: boolean
}

export function Card({ className, asChild, ...props }: CardProps) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="card"
      className={cn(
        "rounded-lg border bg-card text-card-foreground",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

export interface CardTitleProps extends React.ComponentProps<"div"> {
  asChild?: boolean
}

export function CardTitle({ className, asChild, ...props }: CardTitleProps) {
  const Comp = asChild ? Slot : "h2"

  return (
    <Comp
      data-slot="card-title"
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  )
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}
