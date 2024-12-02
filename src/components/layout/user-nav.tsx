import Link from "next/link";
import { LogOut, User, UserCog } from "lucide-react";

import { userData } from "@/data/user";

import { cn, getInitials } from "@/lib/utils";

import type { DirectionType } from "@/types";

import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserNav({ direction }: { direction: DirectionType }) {
  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Avatar className="size-9">
            <AvatarImage
              src={userData?.avatar as string | undefined}
              alt="Avatar"
            />
            <AvatarFallback className="bg-transparent">
              {userData?.name && getInitials(userData.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent forceMount>
        <DropdownMenuLabel className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            asChild
          >
            <Avatar className="size-9">
              <AvatarImage
                src={userData?.avatar as string | undefined}
                alt="Avatar"
              />
              <AvatarFallback className="bg-transparent">
                {userData?.name && getInitials(userData.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
          <dl className="flex flex-col overflow-hidden">
            <dt className="text-sm font-medium truncate">John Doe</dt>
            <dd className="text-xs text-muted-foreground truncate">
              {userData?.email}
            </dd>
          </dl>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-w-48">
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2 focus-visible:ring-0"
              )}
            >
              <User className="size-4 text-muted-foreground" />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2 focus-visible:ring-0"
              )}
            >
              <UserCog className="size-4 text-muted-foreground" />
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="p-0">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <LogOut className="size-4 text-muted-foreground" />
            Sign out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
