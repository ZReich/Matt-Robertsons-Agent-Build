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

export function CardWithImage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wireless Bluetooth Speaker</CardTitle>
        <CardDescription>
          High-quality sound, deep bass, and long battery life.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AspectRatio ratio={16 / 9} className="bg-muted rounded-md">
          <Image
            src="/images/bluetooth-speaker.jpeg"
            alt="Bluetooth Speaker"
            fill
            className="h-full w-full rounded-md object-cover"
          />
        </AspectRatio>
      </CardContent>
      <CardFooter className="flex-col items-start space-y-3">
        <p>
          Experience immersive audio with this compact and stylish Bluetooth
          speaker.
        </p>
        <div className="flex space-x-2">
          <Button>Buy Now</Button>
          <Button variant="secondary">Learn More</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
