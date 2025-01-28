"use client";

import * as React from "react";
import { Bold, Italic, Underline } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function CheckboxAndRadio() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkbox & Radio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Radio Group Input</Label>
          <RadioGroup defaultValue="comfortable">
            <div className="flex items-center space-x-1.5">
              <RadioGroupItem value="default" id="r1" />
              <Label htmlFor="r1">Default</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <RadioGroupItem value="comfortable" id="r2" />
              <Label htmlFor="r2">Comfortable</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <RadioGroupItem value="compact" id="r3" />
              <Label htmlFor="r3">Compact</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-1.5">
          <Label>Switch Input</Label>
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5">
              <Switch id="switch-1" defaultChecked />
              <Label htmlFor="switch-1">Airplane Mode</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <Switch id="switch-2" />
              <Label htmlFor="switch-2">Airplane Mode</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <Switch id="switch-3" defaultChecked disabled />
              <Label htmlFor="switch-3">Airplane Mode</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <Switch id="switch-4" disabled />
              <Label htmlFor="switch-4">Airplane Mode</Label>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Select Input</Label>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a fruit" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Fruits</SelectLabel>
                <SelectItem value="apple">Apple</SelectItem>
                <SelectItem value="banana">Banana</SelectItem>
                <SelectItem value="blueberry">Blueberry</SelectItem>
                <SelectItem value="grapes">Grapes</SelectItem>
                <SelectItem value="pineapple">Pineapple</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Checkbox Input</Label>
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5">
              <Checkbox id="checkbox-1" defaultChecked />
              <Label htmlFor="checkbox-1">Accept terms and conditions</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <Checkbox id="checkbox-2" />
              <Label htmlFor="checkbox-2">Accept terms and conditions</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <Checkbox id="checkbox-3" defaultChecked disabled />
              <Label htmlFor="checkbox-3">Accept terms and conditions</Label>
            </div>
            <div className="flex items-center space-x-1.5">
              <Checkbox id="checkbox-4" disabled />
              <Label htmlFor="checkbox-4">Accept terms and conditions</Label>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Toggle Input</Label>
          <div className="flex flex-wrap items-start">
            <Toggle aria-label="Toggle italic">
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle aria-label="Toggle italic" defaultChecked>
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle variant="outline" aria-label="Toggle italic">
              <Italic />
            </Toggle>
            <Toggle aria-label="Toggle italic">
              <Italic />
              Italic
            </Toggle>
            <Toggle size="sm" aria-label="Toggle italic">
              <Italic />
            </Toggle>
            <Toggle size="lg" aria-label="Toggle italic">
              <Italic />
            </Toggle>
            <Toggle aria-label="Toggle italic" disabled>
              <Underline className="h-4 w-4" />
            </Toggle>
            <Toggle aria-label="Toggle italic" defaultChecked disabled>
              <Underline className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Toggle Group Input</Label>
          <div className="flex flex-col items-start">
            <ToggleGroup type="multiple">
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle strikethrough"
              >
                <Underline className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="multiple" variant="outline">
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle strikethrough"
              >
                <Underline className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single">
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle strikethrough"
              >
                <Underline className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" size="sm">
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle strikethrough"
              >
                <Underline className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="multiple" size="lg">
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle strikethrough"
              >
                <Underline className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="multiple" disabled>
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle strikethrough"
              >
                <Underline className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
