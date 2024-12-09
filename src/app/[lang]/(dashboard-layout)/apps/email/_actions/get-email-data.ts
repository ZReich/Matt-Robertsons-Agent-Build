import { emailsData } from "../_data/emails";

import type { EmailType } from "../types";

export async function getEmailData(
  emailId: string
): Promise<EmailType | undefined> {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Find the email in the emailsData array that matches the provided emailId
    const email = emailsData.find((email) => email.id === emailId);

    return email;
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    throw new Error("Something went wrong.");
  }
}
