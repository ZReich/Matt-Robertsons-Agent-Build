import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Team {
  title: string;
  description: string;
  specialization: string;
  avatar: string;
  total_members: number;
}

const teams: Team[] = [
  {
    title: "Full-Stack Engineers",
    description:
      "Develop and maintain end-to-end solutions, from client-facing front ends to complex server-side logic.",
    specialization: "Coding",
    avatar: "fullstack-engineers-avatar.png",
    total_members: 10,
  },
  {
    title: "UI/UX Designers",
    description:
      "A user-centered design process shapes every interaction and interface. Our team ensures intuitive and engaging experiences.",
    specialization: "Designing",
    avatar: "ui-ux-designers-avatar.png",
    total_members: 3,
  },
  {
    title: "Customer Success Team",
    description:
      "Our team ensures users get the most out of your product while collecting feedback for continuous improvement.",
    specialization: "Support",
    avatar: "customer-success-avatar.png",
    total_members: 3,
  },
  {
    title: "Social Media Marketing",
    description:
      "Utilizing platforms like Instagram and LinkedIn, our marketing team reaches audiences across the globe to boost engagement.",
    specialization: "Marketing",
    avatar: "social-media-marketing-avatar.png",
    total_members: 4,
  },
  {
    title: "Data Scientists",
    description:
      "Leverage Python and advanced analytics tools to extract meaningful insights from big data for data-driven decisions.",
    specialization: "Data Analysis",
    avatar: "data-scientists-avatar.png",
    total_members: 6,
  },
];

export default function Teams() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Teams</CardTitle>
        <MoreVertical className="size-5 stroke-[1.5] text-foreground" />
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {teams.map((team, index) => (
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
