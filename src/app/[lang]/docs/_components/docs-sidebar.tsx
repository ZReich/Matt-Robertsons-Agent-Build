"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

interface DocSection {
  title: string;
  items?: DocSection[]; // Optional for sections with nested items
  href?: string; // Optional for sections with a page.mdx
}

interface DocsSidebarProps {
  items: Array<DocSection>;
}

export function DocsSidebar({ items }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar className="top-16">
      <SidebarContent className="bg-background">
        {items.map((sectionOrItem, index) => {
          // Check if the currentitem is a DocSection
          if ("items" in sectionOrItem && sectionOrItem.items) {
            return (
              <SidebarGroup key={index}>
                <Collapsible defaultOpen className="group/collapsible">
                  <CollapsibleTrigger asChild>
                    {"href" in sectionOrItem ? (
                      <SidebarGroupLabel className="flex items-center justify-between">
                        <Link
                          href={sectionOrItem.href as string}
                          className={cn(
                            "flex-1 underline-offset-4 hover:underline",
                            pathname === sectionOrItem.href && "font-semibold"
                          )}
                        >
                          {sectionOrItem.title}
                        </Link>
                        <ChevronDown className="h-4 w-4" />
                      </SidebarGroupLabel>
                    ) : (
                      <SidebarGroupLabel className="flex items-center justify-between">
                        {sectionOrItem.title}
                        <ChevronDown className="h-4 w-4" />
                      </SidebarGroupLabel>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {sectionOrItem.items.map((item) => (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={pathname === item.href}
                            >
                              <Link href={item.href as string}>
                                {item.title}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            );
          }

          // If it's a DocSection
          return (
            <SidebarMenuItem key={sectionOrItem.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === sectionOrItem.href}
              >
                <Link href={sectionOrItem.href as string}>
                  {sectionOrItem.title}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
