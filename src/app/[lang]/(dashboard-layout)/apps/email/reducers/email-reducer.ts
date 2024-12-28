import type { EmailState, EmailAction, EmailType } from "../types";

const PAGE_SIZE = 10;

export const EmailReducer = (
  state: EmailState,
  action: EmailAction
): EmailState => {
  switch (action.type) {
    case "getFilteredEmails": {
      let filteredEmails = state.initalEmails;

      switch (action.filter) {
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

      // Paginate the filtered emails
      const startIndex = (action.currentPage - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const updatedEmails = filteredEmails.slice(startIndex, endIndex);
      const totalPages = Math.ceil(filteredEmails.length / PAGE_SIZE);
      const totalEmails = filteredEmails.length;

      return {
        ...state,
        emails: updatedEmails,
        selectedEmails: [],
        totalPages,
        currentPage: action.currentPage,
        totalEmails,
      };
    }

    case "getFilteredEmailsBySearchTerm": {
      let filteredEmails = state.initalEmails;

      // Apply folder-based filtering
      switch (action.filter) {
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
      if (action.term) {
        filteredEmails = filteredEmails.filter(
          (email) =>
            email.subject.toLowerCase().includes(action.term.toLowerCase()) ||
            email.sender.name.toLowerCase().includes(action.term.toLowerCase())
        );
      }

      // Paginate the filtered emails
      const startIndex = (action.currentPage - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const updatedEmails = filteredEmails.slice(startIndex, endIndex);
      const totalPages = Math.ceil(filteredEmails.length / PAGE_SIZE);
      const totalEmails = filteredEmails.length;

      return {
        ...state,
        emails: updatedEmails,
        totalPages,
        currentPage: action.currentPage,
        totalEmails,
      };
    }

    case "toggleSelectEmail": {
      const currentSelectedEmails = state.selectedEmails;

      const emailIndex = currentSelectedEmails.findIndex(
        (item) => item.id === action.email.id
      );

      let updatedSelectedEmails;

      if (emailIndex === -1) {
        // Add the email ID if it is not yet selected
        updatedSelectedEmails = [...currentSelectedEmails, action.email];
      } else {
        // Remove the email ID if it is already selected
        updatedSelectedEmails = currentSelectedEmails.filter(
          ({ id }) => id !== action.email.id
        );
      }

      return {
        ...state,
        selectedEmails: updatedSelectedEmails,
      };
    }

    case "toggleSelectAllEmail": {
      let updatedSelectedEmails: EmailType[];

      if (state.selectedEmails.length === state.emails.length) {
        updatedSelectedEmails = []; // Deselect all if all emails are currently selected
      } else {
        updatedSelectedEmails = state.emails; // Select all emails if none or some are selected
      }

      return {
        ...state,
        selectedEmails: updatedSelectedEmails,
      };
    }

    case "toggleStarEmail": {
      const updatedInitalEmails = state.initalEmails.map((email) =>
        email.id === action.email.id
          ? { ...email, starred: !email.starred }
          : email
      );
      const updatedEmails = state.emails.map((email) =>
        email.id === action.email.id
          ? { ...email, starred: !email.starred }
          : email
      );

      return {
        ...state,
        initalEmails: updatedInitalEmails,
        emails: updatedEmails,
      };
    }

    default:
      return state; // Return the current state for unknown actions
  }
};
