"use client";

import Autoplay from "embla-carousel-autoplay";
import { format } from "date-fns";

import { getInitials } from "@/lib/utils";

import type { CustomerSatisfactionType } from "../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShowMoreText } from "@/components/ui/show-more-text";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Ratings } from "@/components/ui/ratings";

export function CustomerSatisfactionTable({
  data,
}: {
  data: CustomerSatisfactionType["feedbacks"];
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
        align: "center",
        loop: true,
      }}
      orientation="vertical"
      className="w-full select-none"
    >
      <CarouselContent className="h-[260px]">
        {data.map((feedback) => (
          <CarouselItem key={feedback.name} className="basis-1/2">
            <Card className="flex flex-col">
              <CardHeader className="flex-row items-center gap-4 p-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={feedback.avatar} alt={feedback.name} />
                  <AvatarFallback>{getInitials(feedback.name)}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <CardTitle className="text-sm font-semibold break-all truncate">
                    {feedback.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground break-all truncate">
                    {feedback.email}
                  </p>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-1.5 p-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Badge>{feedback.rating.toFixed(1)}</Badge>
                    <Ratings
                      variant="yellow"
                      value={feedback.rating}
                      size={16}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(feedback.createdAt, "MMM dd, yyyy")}
                  </p>
                </div>
                <ShowMoreText
                  text={feedback.feedbackMessage}
                  className="text-sm break-all"
                  maxLength={50}
                />
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
