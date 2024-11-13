"use server";

import { teamMembers } from "../_data/team-members";

import type { UserType } from "../types";

export async function getTeamMembersSearchData(
  query: string
): Promise<UserType[]> {
  if (query === "") {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([]);
      }, 250);
    });
  }

  const regex = new RegExp(query, "i");

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(teamMembers.filter((member) => regex.test(member.full_name)));
    }, 300);
  });
}
