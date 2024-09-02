import Link from "next/link";
import { useParams } from "next/navigation";

import ShadboardIcon from "/public/images/logos/shadboard.svg";

import type { Locale } from "@/configs/i18n";

import { getLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: { className?: string }) {
  const params = useParams();

  const locale = params.lang as Locale;

  return (
    <Link
      href={getLocalizedPathname("/", locale)}
      className={cn(
        "flex text-foreground font-black hover:text-primary/90",
        className
      )}
    >
      <ShadboardIcon className="size-6" aira-hidden />
      Shadboard
    </Link>
  );
}
