"use client";

import * as React from "react";
import Image from "next/image";
import { Draggable } from "react-beautiful-dnd";
import { GripVertical, MessageCircleMore, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";

import type { TaskType } from "../types";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KanbanAvatarStack } from "./kanban-avatar-stack";
import { KanbanTaskCardActions } from "./kanban-task-actions";

interface KanbanTaskCardProps {
  task: TaskType;
  index: number;
}

export function KanbanTaskCard({ task, index }: KanbanTaskCardProps) {
  // Memoize avatars to avoid unnecessary recalculations
  const avatars = React.useMemo(() => {
    return task.assigned.map((member) => ({
      src: member.avatar,
      alt: member.name,
      href: "/", // Replace with the correct link to the member's profile, e.g., `/profile/${member.username}`
    }));
  }, [task.assigned]);

  // Check for an image attachment
  const imageAttachment = task.attachments.find((attachment) =>
    attachment.type.includes("image")
  );

  return (
    <Draggable
      draggableId={task.id} // A unique identifier for this task, which helps the library track and move the item
      index={index} // The position of this task in its column, used for reordering tasks when drag-and-drop occurs
    >
      {/* A render callback function that provides the necessary props
        for the Draggable component to function properly */}
      {(provided) => (
        <Card
          ref={provided.innerRef}
          className="my-2 w-64 md:w-72"
          {...provided.draggableProps} // Draggable props for drag-and-drop functionality
        >
          <CardHeader className="flex-row items-center space-y-0 gap-x-1.5 px-3 py-3.5">
            <div
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "icon",
                }),
                "text-secondary-foreground/50 cursor-grab"
              )}
              {...provided.dragHandleProps} // Draggable props for drag-and-drop functionality
              aria-label="Move task"
            >
              <GripVertical className="size-4" />
            </div>
            <Badge>{task.label}</Badge>
            <KanbanTaskCardActions task={task} />
          </CardHeader>
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
          <CardFooter className="justify-between gap-2 pe-3 ps-5">
            <KanbanAvatarStack avatars={avatars} size={8} limit={4} />
            <div className="flex items-center">
              <Button variant="ghost" size="sm">
                <MessageCircleMore className="me-1.5 size-3.5 text-muted-foreground" />
                {task.comments.length}
              </Button>
              <Button variant="ghost" size="sm">
                <Paperclip className="me-1.5 size-3.5 text-muted-foreground" />
                {task.attachments.length}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </Draggable>
  );
}
