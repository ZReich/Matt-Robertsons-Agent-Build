"use client";

import { Calendar } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";

import type { ActiveProjectType } from "../../../../types";

import { Badge } from "@/components/ui/badge";
import { ActiveProjectsItemChart } from "./active-projects-item-chart";

const statusColors = {
  "On Track": {
    badge: "bg-success hover:bg-success/80",
    chart: "hsl(var(--success))",
  },
  "At Risk": {
    badge: "bg-yellow-500 hover:bg-yellow-400 dark:hover:bg-yellow-600",
    chart: "#facc15",
  },
  "On Hold": {
    badge: "bg-muted-foreground hover:bg-muted-foreground/80",
    chart: "hsl(var(--muted-foreground))",
  },
};

export function ActiveProjectsItem({
  project,
}: {
  project: ActiveProjectType;
}) {
  const badgeColor = statusColors[project.status].badge;
  const chartColor = statusColors[project.status].chart;

  return (
    <li className="flex items-center gap-4 py-2 px-4 bg-card border rounded-lg">
      <ActiveProjectsItemChart value={project.progress} color={chartColor} />
      <div>
        <h3>{project.name}</h3>
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="shrink-0 me-2 h-4 w-4" aria-hidden />
          <p>
            {formatDate(project.startDate)} - {formatDate(project.dueDate)}
          </p>
        </div>
      </div>
      <Badge className={cn("h-fit ms-auto", badgeColor)}>
        {project.status}
      </Badge>
    </li>
  );
}
