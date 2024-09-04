import Link from "next/link";
import { LayoutGrid, LogOut, User } from "lucide-react";

import { cn } from "@/lib/utils";

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

export function UserNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Avatar className="size-9">
            <AvatarImage src="/images/avatars/04.png" alt="Avatar" />
            <AvatarFallback className="bg-transparent">JD</AvatarFallback>
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
              <AvatarImage src="/images/avatars/04.png" alt="Avatar" />
              <AvatarFallback className="bg-transparent">JD</AvatarFallback>
            </Avatar>
          </Button>
          <dl className="flex flex-col overflow-hidden">
            <dt className="text-sm font-medium truncate">John Doe</dt>
            <dd className="text-xs text-muted-foreground truncate">
              johndoe@example.com
            </dd>
          </dl>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="hover:cursor-pointer" asChild>
            <Link
              href="/dashboard"
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
              href="/account"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start gap-2"
              )}
            >
              <User className="size-4 text-muted-foreground" />
              Account
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
