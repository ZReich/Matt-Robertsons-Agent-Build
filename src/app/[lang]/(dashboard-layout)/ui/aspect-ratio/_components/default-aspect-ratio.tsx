import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AspectRatio } from "@/components/ui/aspect-ratio";

export function DefaultAspectRatio() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Aspect Ratio</CardTitle>
      </CardHeader>
      <CardContent>
        <AspectRatio ratio={16 / 9} className="bg-muted">
          <Image
            src="/images/placeholder.svg"
            alt=""
            fill
            className="h-full w-full rounded-md object-cover"
          />
        </AspectRatio>
      </CardContent>
    </Card>
  );
}
