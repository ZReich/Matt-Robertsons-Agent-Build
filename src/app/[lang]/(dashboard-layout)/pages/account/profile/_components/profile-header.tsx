import Image from "next/image"
import Link from "next/link"
import { UserPen } from "lucide-react"

import type { LocaleType } from "@/types"
import type { UserType } from "../../types"

import { ensureLocalizedPathname } from "@/lib/i18n"
import { cn, formatNumberToCompact, getInitials } from "@/lib/utils"

import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"

export function ProfileHeader({
  locale,
  user,
}: {
  locale: LocaleType
  user: UserType
}) {
  return (
    <section className="bg-background border-y border-border">
      <AspectRatio ratio={5 / 1} className="bg-muted">
        <Image
          src={user.background}
          fill
          className="h-full w-full object-cover"
          alt="Profile Background"
        />
      </AspectRatio>
      <div className="relative w-full flex flex-col items-center gap-2 p-4 md:flex-row">
        <Avatar className="size-32 -mt-20 border-4 border-background md:size-40">
          <AvatarImage src={user.avatar} alt="Profile Avatar" />
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <Link
          href={ensureLocalizedPathname("/pages/account/settings", locale)}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute top-4 end-4"
          )}
          aria-label="Edit your profile"
        >
          <UserPen className="size-4" />
        </Link>
        <div className="text-center md:text-start">
          <div>
            <h1 className="text-2xl font-bold line-clamp-1">{user.name}</h1>
            <p className="text-muted-foreground line-clamp-1">
              {user.state && user.state + ", "}
              {user.country}
            </p>
          </div>
          <div className="inline-flex w-full">
            <p className="text-primary after:content-['\00b7'] after:mx-1">
              {formatNumberToCompact(user.followers)} followers
            </p>
            <p className="text-primary">
              {formatNumberToCompact(user.connections)} connections
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
