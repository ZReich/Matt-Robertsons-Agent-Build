"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { homeNavigationsData } from "../../_data/home-navigations";

import { isActivePathname } from "@/lib/utils";

import { buttonVariants } from "@/components/ui/button";
import { HomeSidebar } from "./home-sidebar";
import { ModeDropdown } from "../../../_components/mode-dropdown";

export function Header() {
  const pathname = usePathname();
  const params = useParams();
  const [fullPathname, setFullPathname] = React.useState("");

  React.useEffect(() => {
    setFullPathname(pathname + window.location.hash);
  }, [params, pathname]);

  return (
    <header className="container sticky top-0 z-50 w-full flex justify-between items-center gap-2 p-4 bg-background border-b border-border">
      <Link
        href="/"
        className="flex text-foreground font-black hover:text-primary/90"
      >
        <Image
          src="/images/icons/shadboard.svg"
          alt=""
          height={24}
          width={24}
          className="dark:invert"
        />
        <span>Shadboard</span>
      </Link>
      <ul className="hidden gap-2 me-16 lg:flex">
        {homeNavigationsData.map((nav) => {
          const isActive = isActivePathname(nav.href, fullPathname, true);

          return (
            <li key={nav.href}>
              <Link
                href={nav.href}
                className={buttonVariants({
                  variant: isActive ? "secondary" : "ghost",
                })}
              >
                {nav.title}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-x-2">
        <ModeDropdown />
        <HomeSidebar fullPathname={fullPathname} />
      </div>
    </header>
  );
}
