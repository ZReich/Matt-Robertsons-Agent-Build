"use client";

import * as React from "react";
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
  const avatars = React.useMemo(() => {
    return task.assigned.map((member) => ({
      src: member.avatar,
      alt: member.fullName,
      href: `/profile/${member.username}`,
    }));
  }, [task.assigned]);

  const imageAttachment = task.attachments.find((attachment) =>
    attachment.type.includes("image")
  );

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <Card
          ref={provided.innerRef}
          className="my-2 w-64 md:w-72"
          {...provided.draggableProps}
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
              {...provided.dragHandleProps}
            >
              <GripVertical className="size-4" />
              <span className="sr-only">Move task</span>
            </div>
            <Badge>{task.label}</Badge>
            <KanbanTaskCardActions task={task} />
          </CardHeader>
          <CardContent>
            <CardTitle>{task.title}</CardTitle>
            <CardDescription>{task.description}</CardDescription>
            {imageAttachment && (
              <img
                src={imageAttachment.url}
                alt={imageAttachment.name || "Task attachment"}
                className="w-full h-auto mt-2 rounded-md"
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
