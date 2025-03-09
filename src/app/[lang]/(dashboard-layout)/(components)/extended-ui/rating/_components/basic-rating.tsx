"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Rating } from "@/components/ui/rating"

export function BasicRating() {
  const [rating, setRating] = React.useState("0")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Rating</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Rating value={rating} onValueChange={setRating} />
      </CardContent>
    </Card>
  )
}
