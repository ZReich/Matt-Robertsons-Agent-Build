"use client";

import * as React from "react";

import { Ratings } from "@/components/ui/ratings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RatingsVariants() {
  const [rating, setRating] = React.useState("0");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ratings Variants</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-center gap-2">
        <div className="space-y-1.5">
          <h4>Default</h4>
          <Ratings value={rating} onValueChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <h4>Primary</h4>
          <Ratings variant="primary" value={rating} onValueChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <h4>Secondary</h4>
          <Ratings
            variant="secondary"
            value={rating}
            onValueChange={setRating}
          />
        </div>
      </CardContent>
    </Card>
  );
}
