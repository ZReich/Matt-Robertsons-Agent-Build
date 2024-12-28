import type { DynamicIconNameType } from "@/types";

export interface UserType {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  status: string;
}

export interface EmailType {
  id: string;
  sender: UserType;
  subject: string;
  content: string;
  read: boolean;
  starred: boolean;
  createdAt: Date;
  folder: "Inbox" | "Sent" | "Draft";
  isStarred: boolean;
  isSpam: boolean;
  isDeleted: boolean;
}

export interface EmailState {
  initalEmails: EmailType[];
  emails: EmailType[];
  selectedEmails: EmailType[];
  currentPage: number;
  totalPages: number;
  totalEmails: number;
}

export interface EmailSidebarLabel {
  iconName: DynamicIconNameType;
  label: string;
  param: string;
  unreadCount: number;
}

export interface EmailContextType {
  emailState: EmailState;
  isEmailSidebarOpen: boolean;
  setIsEmailSidebarOpen: (val: boolean) => void;
  handleGetFilteredEmails: (filter: string, currentPage: number) => void;
  handleGetFilteredEmailsBySearchTerm: (
    term: string,
    filter: string,
    currentPage: number
  ) => void;
  handleToggleSelectEmail: (email: EmailType) => void;
  handleToggleSelectAllEmails: () => void;
  handleToggleStarEmail: (email: EmailType) => void;
}

export type EmailAction =
  | {
      type: "getFilteredEmails";
      currentPage: number;
      filter: string;
    }
  | {
      type: "getFilteredEmailsBySearchTerm";
      currentPage: number;
      term: string;
      filter: string;
    }
  | {
      type: "toggleSelectEmail";
      email: EmailType;
    }
  | {
      type: "toggleStarEmail";
      email: EmailType;
    }
  | {
      type: "toggleSelectAllEmail";
    };
