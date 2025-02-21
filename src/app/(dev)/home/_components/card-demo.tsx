import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

export interface CardDemoProps {
  title: string;
  href: string;
  imgSrc: string;
}

export function CardDemo({ title, href, imgSrc }: CardDemoProps) {
  return (
    <article className="bg-background border border-border rounded-lg overflow-hidden">
      <div className="flex justify-between items-center gap-x-1.5 p-6 pb-0">
        <h3 className="font-semibold">{title}</h3>
        <Link
          href={href}
          className={cn(
            "shrink-0",
            buttonVariants({
              size: "icon",
            })
          )}
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
      <AspectRatio ratio={16 / 9} className="bg-muted m-4 mb-0 rounded-t-md">
        <Image
          src={imgSrc}
          alt=""
          width={633}
          height={360}
          sizes="(max-width: 768px) 320px, 640px"
          className="border border-b-0 border-border rounded-t-md object-cover"
        />
      </AspectRatio>
    </article>
  );
}
