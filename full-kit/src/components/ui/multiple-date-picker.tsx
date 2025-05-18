"use client"

import { Fragment } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type MultipleDatesPickerProps = Omit<
  ComponentProps<typeof Calendar>,
  "mode" | "selected" | "onSelect"
> & {
  value?: Date[]
  onValueChange: (dates?: Date[]) => void
  formatStr?: string
  popoverContentClassName?: string
  popoverContentOptions?: ComponentProps<typeof PopoverContent>
  buttonClassName?: string
  buttonOptions?: ComponentProps<typeof Button>
  placeholder?: string
}

export function MultipleDatesPicker({
  value,
  onValueChange,
  formatStr = "yyyy-MM-dd p",
  popoverContentClassName,
  popoverContentOptions,
  buttonClassName,
  buttonOptions,
  placeholder = "Pick dates",
  ...props
}: MultipleDatesPickerProps) {
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "flex w-full gap-2 px-3 font-normal overflow-hidden",
            buttonClassName
          )}
          {...buttonOptions}
        >
          <span className="flex-1 truncate text-left">
            {value && value.length > 0 ? (
              value.map((date, index) => (
                <Fragment key={index}>
                  <span className="truncate">{format(date, formatStr)}</span>
                  {index < value.length - 1 && <span className="mx-1">,</span>}
                </Fragment>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-auto p-0", popoverContentClassName)}
        align="start"
        {...popoverContentOptions}
      >
        <Calendar
          mode="multiple"
          selected={value}
          onSelect={onValueChange}
          {...props}
        />
      </PopoverContent>
    </Popover>
  )
}
