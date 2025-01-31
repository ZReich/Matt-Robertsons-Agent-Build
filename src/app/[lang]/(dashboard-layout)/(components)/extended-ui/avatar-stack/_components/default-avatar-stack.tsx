"use client";

import * as React from "react";

import { avatarsData } from "../_data/avatars";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarStack } from "@/components/ui/avatar";

export function DefaultAvatarStack() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <AvatarStack avatars={avatarsData} />
      </CardContent>
    </Card>
  );
}
