"use client";

import * as React from "react";

import { avatarsData } from "../_data/avatars";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarStack } from "@/components/ui/avatar";

export function AvatarStackLimit() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Limit</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-center gap-2">
        <AvatarStack avatars={avatarsData} limit={2} />
        <AvatarStack avatars={avatarsData} limit={3} />
      </CardContent>
    </Card>
  );
}
