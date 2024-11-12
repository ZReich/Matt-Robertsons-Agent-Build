import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { teamsData } from "../_data/teams";

import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Teams() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Teams</CardTitle>
        <MoreVertical className="size-5 stroke-[1.5] text-foreground" />
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {teamsData.map((team, index) => (
            <li key={index} className="flex items-center justify-between gap-2">
              <Avatar>
                <AvatarImage src={team.avatar} alt={team.title} />
                <AvatarFallback>{team.title.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="me-auto">
                <p className="font-medium">{team.title}</p>
                <p className="text-sm text-foreground">
                  {team.total_members} members
                </p>
              </div>
              <Badge>{team.specialization}</Badge>
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
