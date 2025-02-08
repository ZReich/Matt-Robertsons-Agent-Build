import Image from "next/image";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export function CardWithImageHorizontal() {
  return (
    <Card className="grid grid-cols-5">
      <CardHeader className="col-span-2">
        <AspectRatio ratio={1 / 1} className="bg-muted rounded-md">
          <Image
            src="/images/bluetooth-speaker.jpeg"
            alt="Bluetooth Speaker"
            fill
            className="h-full w-full rounded-md object-cover"
          />
        </AspectRatio>
      </CardHeader>
      <div className="col-span-3">
        <CardContent className="pt-6 ps-0">
          <CardTitle>Wireless Bluetooth Speaker</CardTitle>
          <CardDescription>
            High-quality sound, deep bass, and long battery life.
          </CardDescription>
        </CardContent>
        <CardFooter className="gap-x-3 pt-6 ps-0">
          <Button>Buy Now</Button>
          <Button variant="secondary">Learn More</Button>
        </CardFooter>
      </div>
    </Card>
  );
}
