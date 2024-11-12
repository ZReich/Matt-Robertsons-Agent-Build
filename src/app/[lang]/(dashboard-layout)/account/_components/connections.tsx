import Link from "next/link";
import { UserPlus, UserX, MoreVertical } from "lucide-react";

import { connectionsData } from "../_data/connections";

import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";

export function Connections() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Connections</CardTitle>
        <MoreVertical className="size-5 stroke-[1.5] text-foreground" />
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {connectionsData.map((connection, index) => (
            <li key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={connection.avatar} alt={connection.name} />
                  <AvatarFallback>{connection.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{connection.name}</p>
                  <p className="text-sm text-foreground">
                    {connection.connections} Connections
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                {connection.is_following ? (
                  <UserX className="size-5 stroke-[1.5] text-destructive" />
                ) : (
                  <UserPlus className="size-5 stroke-[1.5]" />
                )}
              </Button>
            </li>
          ))}
        </ul>
        <Link
          href="#"
          className={cn(buttonVariants({ variant: "link" }), "mt-4 w-full")}
        >
          View all connections
        </Link>
      </CardContent>
    </Card>
  );
}
