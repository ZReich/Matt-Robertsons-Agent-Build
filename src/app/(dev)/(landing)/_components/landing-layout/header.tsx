"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { landingNavigationsData } from "../../_data/landing-navigations";

import { isActivePathname } from "@/lib/utils";

import { buttonVariants } from "@/components/ui/button";
import { LandingSidebar } from "./landing-sidebar";
import { ModeDropdown } from "../../../_components/mode-dropdown";

import Logo from "/public/images/icons/shadboard.svg";

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
        <Logo className="size-6" aira-hidden="true" />
        Shadboard
      </Link>
      <ul className="hidden gap-2 me-16 lg:flex">
        {landingNavigationsData.map((nav) => {
          const isActive = isActivePathname(nav.href, fullPathname);

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
        <LandingSidebar fullPathname={fullPathname} />
      </div>
    </header>
  );
}
