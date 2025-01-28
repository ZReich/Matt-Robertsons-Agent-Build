"use client";

import * as React from "react";

import { Ratings } from "@/components/ui/ratings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RatingsLength() {
  const [rating, setRating] = React.useState("0");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Length</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-center gap-2">
        <Ratings value={rating} onValueChange={setRating} />
        <Ratings value={rating} onValueChange={setRating} length={4} />
        <Ratings value={rating} onValueChange={setRating} length={3} />
      </CardContent>
    </Card>
  );
}
