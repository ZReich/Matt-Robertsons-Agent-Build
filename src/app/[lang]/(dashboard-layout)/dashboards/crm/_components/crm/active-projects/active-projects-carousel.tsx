"use client";

import Autoplay from "embla-carousel-autoplay";
import { Calendar } from "lucide-react";

import { formatDate } from "@/lib/utils";

import type { ActiveProjectType } from "../../../types";

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
            className="w-8 md:basis-1/2 md:w-auto"
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
                  <div className="flex flex-wrap justify-between">
                    <p className="text-sm text-muted-foreground">
                      {project.progress}% Complete
                    </p>
                    <Badge className={statusColor[project.status]}>
                      {project.status}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="shrink-0 me-2 h-4 w-4" aria-hidden />
                    <p>
                      {formatDate(project.startDate)} -{" "}
                      {formatDate(project.dueDate)}
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
