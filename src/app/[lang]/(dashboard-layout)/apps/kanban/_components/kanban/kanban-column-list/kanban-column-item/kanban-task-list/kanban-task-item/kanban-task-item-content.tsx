"use client";

import * as React from "react";
import Image from "next/image";

import type { TaskType } from "../../../../../../types";

import { CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface KanbanTaskItemContentProps {
  task: TaskType;
}

export function KanbanTaskItemContent({ task }: KanbanTaskItemContentProps) {
  // Check for an image attachment
  const imageAttachment = task.attachments.find((attachment) =>
    attachment.type.includes("image")
  );

  return (
    <CardContent>
      <CardTitle>{task.title}</CardTitle>
      <CardDescription>{task.description}</CardDescription>
      {/* Display image attachment if available */}
      {imageAttachment && (
        <Image
          src={imageAttachment.url}
          alt={imageAttachment.name || "Task attachment"}
          className="w-full h-auto mt-2 rounded-md"
          height={288}
          width={288}
        />
      )}
    </CardContent>
  );
}
