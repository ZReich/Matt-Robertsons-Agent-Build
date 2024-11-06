import Link from "next/link";
import { LayoutGrid, LogOut, User, UserCog } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { cn, getInitials } from "@/lib/utils";

import { Direction } from "@/types";
import { Locale } from "@/configs/i18n";

import { getLocalizedPathname } from "@/lib/i18n";

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

export function UserNav({ dir, locale }: { dir: Direction; locale: Locale }) {
  const { data } = useSession();
  const user = data?.user;

  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Avatar className="size-9">
            <AvatarImage
              src={user?.avatar as string | undefined}
              alt="Avatar"
            />
            <AvatarFallback className="bg-transparent">
              {user?.name && getInitials(user.name)}
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
                src={user?.avatar as string | undefined}
                alt="Avatar"
              />
              <AvatarFallback className="bg-transparent">
                {user?.name && getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
          <dl className="flex flex-col overflow-hidden">
            <dt className="text-sm font-medium truncate">John Doe</dt>
            <dd className="text-xs text-muted-foreground truncate">
              {user?.email}
            </dd>
          </dl>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-w-48">
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <Link
              href={getLocalizedPathname("/dashboard", locale)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2"
              )}
            >
              <LayoutGrid className="size-4 text-muted-foreground" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <Link
              href={getLocalizedPathname("/account", locale)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2"
              )}
            >
              <User className="size-4 text-muted-foreground" />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <Link
              href={getLocalizedPathname("/account/settings", locale)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2"
              )}
            >
              <UserCog className="size-4 text-muted-foreground" />
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="p-0">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => signOut()}
          >
            <LogOut className="size-4 text-muted-foreground" />
            Sign out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
