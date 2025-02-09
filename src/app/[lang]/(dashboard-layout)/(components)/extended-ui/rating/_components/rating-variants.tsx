"use client";

import * as React from "react";

import { Rating } from "@/components/ui/rating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RatingVariants() {
  const [rating, setRating] = React.useState("0");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Variants</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-center gap-2">
        <div className="space-y-1.5">
          <h4>Default</h4>
          <Rating value={rating} onValueChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <h4>Primary</h4>
          <Rating variant="primary" value={rating} onValueChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <h4>Muted</h4>
          <Rating variant="muted" value={rating} onValueChange={setRating} />
        </div>
      </CardContent>
    </Card>
  );
}
