"use client"

import { forwardRef } from "react"
import { format } from "date-fns"
import { Clock } from "lucide-react"

import type { ButtonProps } from "@/components/ui/button"
import type { InputTimeProps } from "@/components/ui/input-time"
import type { ComponentPropsWithoutRef } from "react"

import { cn, timeToDate } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { InputTime } from "@/components/ui/input-time"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface TimePickerProps extends InputTimeProps {
  value: string | undefined
  popoverContentClassName?: string
  popoverContentOptions?: ComponentPropsWithoutRef<typeof PopoverContent>
  buttonClassName?: string
  buttonOptions?: ButtonProps
  placeholder?: string
}

const TimePicker = forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      popoverContentClassName,
      popoverContentOptions,
      buttonClassName,
      buttonOptions,
      placeholder = "Pick time",
      ...props
    },
    ref
  ) => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            className={cn(
              "w-full px-3 text-start font-normal",
              buttonClassName
            )}
            {...buttonOptions}
          >
            {value ? (
              <span>{format(timeToDate(value), "p")}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <Clock className="ms-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto p-0", popoverContentClassName)}
          align="start"
          {...popoverContentOptions}
        >
          <InputTime className="border-0" value={value} {...props} />
        </PopoverContent>
      </Popover>
    )
  }
)
TimePicker.displayName = "TimePicker"

export { TimePicker }
