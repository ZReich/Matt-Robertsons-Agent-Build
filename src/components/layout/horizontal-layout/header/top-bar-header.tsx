"use client";

import { groupNavs } from "@/data/navigation";

import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { CommandMenu } from "@/components/layout/command-menu";
import { Nav } from "@/components/layout/nav";

export function TopBarHeader() {
  return (
    <div className="container hidden justify-between items-center py-1 md:flex">
      <Menubar className="shadow-none border-0">
        {groupNavs.map((group, index) => (
          <MenubarMenu key={index}>
            <MenubarTrigger className="gap-2 hover:cursor-pointer focus:bg-primary focus:text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground">
              {group.name}
            </MenubarTrigger>
            <MenubarContent>
              <Nav navs={group.navs} />
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
      <CommandMenu />
    </div>
  );
}
