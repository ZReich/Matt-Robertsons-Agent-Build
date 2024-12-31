"use client";

import * as React from "react";
import { MessageCircleMore, Paperclip } from "lucide-react";

import type { TaskType } from "../../../../../../../types";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { KanbanAvatarStack } from "./kanban-avatar-stack";

interface KanbanTaskItemFooterProps {
  task: TaskType;
}

export function KanbanTaskItemFooter({ task }: KanbanTaskItemFooterProps) {
  const avatars = React.useMemo(() => {
    return task.assigned.map((member) => ({
      src: member.avatar,
      alt: member.name,
      href: "/", // Replace with the correct link to the member's profile, e.g., `/profile/${member.username}`
    }));
  }, [task.assigned]);

  return (
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
  );
}
