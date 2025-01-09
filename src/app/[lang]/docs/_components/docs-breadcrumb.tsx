"use client";

import { usePathname } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function DocsBreadcrumb() {
  const pathname = usePathname();
  const paths = pathname.split("/").filter(Boolean);
  const pathsOfDocs = paths.slice(3);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={ensureLocalizedPathname("/docs", paths[0])}>
            Home
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {paths[2].replace("-", " ").toLowerCase()}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {pathsOfDocs.map((segment, index) => {
          const href = "/" + pathsOfDocs.slice(0, index + 1).join("/");
          const label = segment.replace("-", " ").toLowerCase();

          return (
            <BreadcrumbItem key={ensureLocalizedPathname(href, paths[0])}>
              {index === pathsOfDocs.length - 1 ? (
                <BreadcrumbPage className="capitalize">{label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink
                    href={ensureLocalizedPathname(href, paths[0])}
                    className="capitalize"
                  >
                    {label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
