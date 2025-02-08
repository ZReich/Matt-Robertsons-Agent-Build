"use client";

import * as React from "react";

import { avatarsData } from "../_data/avatars";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarStack } from "@/components/ui/avatar";

export function BasicAvatarStack() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Avatar Stack</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <AvatarStack avatars={avatarsData} />
      </CardContent>
    </Card>
  );
}
