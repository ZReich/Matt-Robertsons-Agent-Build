"use client";

import * as React from "react";
import { CalendarIcon, Mail } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

export function BasicInputs() {
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Inputs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="enabledInput">Enabled Input</Label>
          <Input type="text" id="enabledInput" placeholder="John Doe" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="readOnlyInput">Readonly Input</Label>
          <Input
            type="text"
            id="readOnlyInput"
            placeholder="John Doe"
            readOnly
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disabledInput">Disabled Input</Label>
          <Input
            type="text"
            id="disabledInput"
            placeholder="John Doe"
            disabled
          />
        </div>
        <div>
          <Label htmlFor="inputWithIcon">Input with Icon</Label>
          <div className="relative">
            <Input
              type="email"
              id="inputWithIcon"
              placeholder="john.doe@example.com"
              className="ps-10"
            />
            <Mail className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
          </div>
        </div>
        <div>
          <Label htmlFor="inputWithIconRight">Input with Icon Right</Label>
          <div className="relative">
            <Input
              type="email"
              id="inputWithIconRight"
              placeholder="john.doe@example.com"
              className="pe-10"
            />
            <Mail className="absolute end-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
          </div>
        </div>
        <div>
          <Label htmlFor="calendarInput">Calendar Input</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full ps-3 text-start font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                {date ? formatDate(date) : <span>Pick a date</span>}
                <CalendarIcon className="ms-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                id="calendarInput"
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="passwardInput">Passward Input</Label>
          <Input type="password" id="passwardInput" defaultValue="12345678" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="textarea">Textarea</Label>
          <Textarea id="textarea" placeholder="Type your message here." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="colorPicker">Color Picker</Label>
          <Input type="color" id="colorPicker" />
        </div>
        <div className="space-y-1.5">
          <Label>Range Slider</Label>
          <Slider defaultValue={[33]} max={100} step={1} />
        </div>
      </CardContent>
    </Card>
  );
}
