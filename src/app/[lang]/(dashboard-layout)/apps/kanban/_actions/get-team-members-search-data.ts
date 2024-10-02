"use server";

import { UserType } from "../types";

const teamMembers: UserType[] = [
  {
    id: "member-0",
    username: "john.doe",
    full_name: "John Doe",
    avatar: "/images/avatars/01.png",
  },
  {
    id: "member-1",
    username: "jane.smith",
    full_name: "Jane Smith",
    avatar: "/images/avatars/02.png",
  },
  {
    id: "member-2",
    username: "paul.johnson",
    full_name: "Paul Johnson",
    avatar: "/images/avatars/03.png",
  },
  {
    id: "member-3",
    username: "emily.davis",
    full_name: "Emily Davis",
    avatar: "/images/avatars/04.png",
  },
  {
    id: "member-4",
    username: "tom.clark",
    full_name: "Tom Clark",
    avatar: "/images/avatars/05.png",
  },
];

export async function getTeamMembersSearchData(
  query: string
): Promise<UserType[]> {
  if (query === "") {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([]);
      }, 300);
    });
  }

  const regex = new RegExp(query, "i");

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(teamMembers.filter((member) => regex.test(member.full_name)));
    }, 300);
  });
}
