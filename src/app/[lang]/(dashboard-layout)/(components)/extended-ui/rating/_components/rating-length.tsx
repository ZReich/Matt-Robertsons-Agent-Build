"use client";

import * as React from "react";

import { Rating } from "@/components/ui/rating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RatingLength() {
  const [rating, setRating] = React.useState("0");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Length</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-center gap-2">
        <Rating value={rating} onValueChange={setRating} />
        <Rating value={rating} onValueChange={setRating} length={4} />
        <Rating value={rating} onValueChange={setRating} length={3} />
      </CardContent>
    </Card>
  );
}
