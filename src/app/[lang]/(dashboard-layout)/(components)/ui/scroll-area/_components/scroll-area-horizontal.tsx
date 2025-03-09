"use client"

import * as React from "react"
import Image from "next/image"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

export function ScrollAreaHorizontal() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scroll-Area Horizontal</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <ScrollArea className="rounded-md border">
          <div className="flex gap-x-4 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Image
                key={index}
                src="https://images.unsplash.com/photo-1635315619556-5826839a1bea"
                alt=""
                className="shrink-0 aspect-[3/4] object-cover rounded-md overflow-hidden"
                width={165}
                height={250}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
