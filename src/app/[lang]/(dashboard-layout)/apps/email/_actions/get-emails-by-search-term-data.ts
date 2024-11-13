import { emailsData } from "../_data/emails";

import type { EmailState } from "../types";

export async function getEmailsBySearchTermData(
  page: number = 1,
  filter?: string,
  term?: string
): Promise<EmailState | undefined> {
  const pageSize = 10;

  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Apply filtering based on the filter
    let filteredEmails = emailsData;

    // Apply folder-based filtering
    switch (filter) {
      case "inbox":
        filteredEmails = filteredEmails.filter(
          (email) =>
            email.folder === "Inbox" && !email.isSpam && !email.isDeleted
        );
        break;
      case "sent":
        filteredEmails = filteredEmails.filter(
          (email) => email.folder === "Sent" && !email.isDeleted
        );
        break;
      case "draft":
        filteredEmails = filteredEmails.filter(
          (email) => email.folder === "Draft" && !email.isDeleted
        );
        break;
      case "starred":
        filteredEmails = filteredEmails.filter(
          (email) => email.isStarred && !email.isDeleted
        );
        break;
      case "spam":
        filteredEmails = filteredEmails.filter(
          (email) => email.isSpam && !email.isDeleted
        );
        break;
      case "trash":
        filteredEmails = filteredEmails.filter((email) => email.isDeleted);
        break;
      default:
        break;
    }

    // Apply term-based search if 'term' is provided
    if (term) {
      filteredEmails = filteredEmails.filter(
        (email) =>
          email.subject.toLowerCase().includes(term.toLowerCase()) ||
          email.sender.name.toLowerCase().includes(term.toLowerCase())
      );
    }

    // Paginate the filtered emails
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEmails = filteredEmails.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredEmails.length / pageSize);
    const totalEmails = filteredEmails.length;

    return {
      emails: paginatedEmails,
      totalPages,
      currentPage: page,
      totalEmails,
    };
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    throw new Error("Something went wrong.");
  }
}
