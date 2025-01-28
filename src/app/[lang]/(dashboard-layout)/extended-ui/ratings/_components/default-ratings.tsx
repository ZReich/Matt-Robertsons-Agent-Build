"use client";

import * as React from "react";

import { Ratings } from "@/components/ui/ratings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultRatings() {
  const [rating, setRating] = React.useState("0");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Ratings value={rating} onValueChange={setRating} />
      </CardContent>
    </Card>
  );
}
