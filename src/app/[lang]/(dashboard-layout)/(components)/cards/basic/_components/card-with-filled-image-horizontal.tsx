import Image from "next/image"

import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CardWithFilledImageHorizontal() {
  return (
    <Card className="grid grid-cols-5">
      <CardHeader className="col-span-2 p-0 pe-6">
        <AspectRatio ratio={1 / 1} className="bg-muted">
          <Image
            src="/images/misc/product-03.jpg"
            alt="USB-C to SD Card Reader"
            fill
            className="h-full w-full object-cover"
          />
        </AspectRatio>
      </CardHeader>
      <div className="col-span-3 flex flex-col justify-between gap-y-3 py-6">
        <CardContent className="p-0">
          <CardTitle>USB-C to SD Card Reader</CardTitle>
          <CardDescription>
            Easily transfer photos and videos from your SD card to your USB-C
            device with this high-speed reader.
          </CardDescription>
        </CardContent>
        <CardFooter className="gap-x-3 p-0">
          <Button>Buy Now</Button>
          <Button variant="secondary">Learn More</Button>
        </CardFooter>
      </div>
    </Card>
  )
}
