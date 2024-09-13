import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { UserPen } from "lucide-react";
import { getLocalizedPathname } from "@/lib/i18n";
import { Locale } from "@/configs/i18n";
import Link from "next/link";
import { cn } from "@/lib/utils";

const profile = {
  full_name: "John Doe",
  role: "Next.js Developer",
  avatar: "/images/avatars/04.png",
  background: "/images/background.jpg",
};

export function ProfileHeader({ locale }: { locale: Locale }) {
  const { full_name, role, avatar, background } = profile;

  return (
    <section className="container px-0">
      <div className="relative h-[180px] w-full md:h-[250px]">
        <Image
          src={background || "/images/placeholder.svg"}
          fill
          className="object-cover"
          alt="Profile Background"
        />
      </div>
      <div className="container p-4 md:px-8 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 md:size-16">
              <AvatarImage src={avatar} alt="Profile Avatar" />
              <AvatarFallback>{full_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{full_name}</h1>
              <p className="text-muted-foreground">{role}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={getLocalizedPathname("/account/settings", locale)}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              <UserPen className="me-2 size-4 stroke-[1.5]" />
              Edit
            </Link>
          </div>
        </div>
        <Separator className="mt-8" />
      </div>
    </section>
  );
}
