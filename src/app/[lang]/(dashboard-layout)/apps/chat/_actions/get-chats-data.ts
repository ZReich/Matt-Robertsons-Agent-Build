"use server";

import { chatsData } from "../_data/chats";

import type { ChatType } from "../types";

export async function getChatsData(): Promise<ChatType[]> {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(chatsData);
      }, 250);
    });
  } catch (error) {
    console.error("Database Error: Failed to Get chats data:", error);

    throw new Error(
      "An unexpected issue occurred. If this persists, please contact support."
    );
  }
}
