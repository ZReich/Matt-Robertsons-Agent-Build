"use server";

import { teamMembers } from "../_data/team-members";

import { wait } from "@/lib/utils";

import type { UserType } from "../types";

export async function getTeamMembersSearchData(
  query: string
): Promise<UserType[]> {
  await wait(); // Simulate a network delay

  // Return an empty array if the search query is empty
  if (query === "") {
    return [];
  }

  // Create a case-insensitive regular expression based on the query
  const regex = new RegExp(query, "i");

  // Filter the team members whose names match the query
  const matchedResults = teamMembers.filter((member) => regex.test(member.name));

  return matchedResults;
}
