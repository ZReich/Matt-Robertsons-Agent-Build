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

export function CardWithFilledImage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Smartwatch</CardTitle>
        <CardDescription>
          Stay connected, track fitness, and enjoy seamless notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <AspectRatio ratio={16 / 9} className="bg-muted">
          <Image
            src="/images/misc/product-02.jpg"
            alt="Smartwatch"
            fill
            className="h-full w-full object-cover"
          />
        </AspectRatio>
      </CardContent>
      <CardFooter className="flex-col items-start space-y-3">
        <p>
          Enhance your lifestyle with this sleek and feature-packed smartwatch.
        </p>
        <div className="flex gap-x-2">
          <Button>Buy Now</Button>
          <Button variant="secondary">Learn More</Button>
        </div>
      </CardFooter>
    </Card>
  )
}
