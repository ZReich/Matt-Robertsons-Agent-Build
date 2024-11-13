"use server";

import { chatData } from "../_data/chat";

export async function getChatData(chatId: string) {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = chatData.find((chat) => chat.id === chatId);
        resolve(result);
      }, 250);
    });
  } catch (error) {
    console.error("Error fetching chat data for chat ID:", chatId, error);
    throw new Error(
      "An unexpected issue occurred. If this persists, please contact support."
    );
  }
}
