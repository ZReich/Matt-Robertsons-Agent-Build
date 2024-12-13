import Image from "next/image";
import Link from "next/link";
import { UserPen } from "lucide-react";

import type { LocaleType } from "@/configs/i18n";
import type { UserType } from "../types";

import { cn, getInitials } from "@/lib/utils";
import { ensureLocalizedPathname } from "@/lib/i18n";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";

export function ProfileHeader({
  locale,
  user,
}: {
  locale: LocaleType;
  user: UserType;
}) {
  const { name, role, avatar, background } = user;

  return (
    <section className="bg-background border border-border">
      <div className="relative h-[180px] w-full md:h-[250px]">
        <Image
          src={background || "/images/placeholder.svg"} // Fallback placeholder image
          fill
          className="object-cover"
          alt="Profile Background"
        />
      </div>
      <div className="w-full flex justify-between items-center p-4 md:p-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 md:size-16">
            <AvatarImage src={avatar} alt="Profile Avatar" />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-muted-foreground">{role}</p>
          </div>
        </div>
        <Link
          href={ensureLocalizedPathname("/account/settings", locale)}
          className={cn(buttonVariants({ variant: "default" }))}
        >
          <UserPen className="me-2 size-4 stroke-[1.5]" />
          Edit
        </Link>
      </div>
    </section>
  );
}
