"use client";

import Autoplay from "embla-carousel-autoplay";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

import type { ActiveProjectType } from "../../types";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const statusColor = {
  "On Track": "bg-success hover:bg-success/80",
  "At Risk": "bg-yellow-500 hover:bg-yellow-400 dark:hover:bg-yellow-600",
  "On Hold": "bg-muted-foreground hover:bg-muted-foreground/80",
};

export function ActiveProjectsCarousel({
  data,
}: {
  data: ActiveProjectType[];
}) {
  return (
    <Carousel
      plugins={[
        Autoplay({
          delay: 2500,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
        }),
      ]}
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full select-none"
    >
      <CarouselContent>
        {data.map((project) => (
          <CarouselItem
            key={project.name}
            className="md:basis-1/2"
          >
            <Card>
              <CardHeader>
                <h4 className="font-semibold leading-none tracking-tight">
                  {project.name}
                </h4>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={project.progress} className="w-full" />
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">
                      {project.progress}% Complete
                    </p>
                    <Badge className={statusColor[project.status]}>
                      {project.status}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="me-2 h-4 w-4" aria-hidden />
                    <p>
                      {format(project.startDate, "MMM dd, yyyy")} -{" "}
                      {format(project.dueDate, "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
