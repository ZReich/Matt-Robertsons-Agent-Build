"use client"

import { forwardRef, useState } from "react"

import type { ChangeEvent, InputHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import { Input } from "./input"

export interface InputTimeProps extends InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value?: string) => void
}

const InputTime = forwardRef<HTMLInputElement, InputTimeProps>(
  ({ className, onValueChange, ...props }, ref) => {
    const [isEmpty, setIsEmpty] = useState(!props.defaultValue && !props.value)

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value

      setIsEmpty(!value)
      onValueChange?.(value)
    }

    return (
      <Input
        ref={ref}
        className={cn(
          "block [&::-webkit-calendar-picker-indicator]:hidden rtl:text-right",
          isEmpty && "text-muted-foreground",
          className
        )}
        {...props}
        type="time"
        onChange={handleChange}
      />
    )
  }
)
InputTime.displayName = "InputTime"

export { InputTime }
