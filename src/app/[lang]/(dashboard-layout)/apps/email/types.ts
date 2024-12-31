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
  label?: "personal" | "important" | "work";
  isDraft: boolean;
  isSent: boolean;
  isStarred: boolean;
  isSpam: boolean;
  isDeleted: boolean;
}

export interface EmailState {
  initialEmails: EmailType[];
  sidebarItems: EmailSidebarItems;
  emails: EmailType[];
  selectedEmails: EmailType[];
  currentPage: number;
  totalPages: number;
  totalEmails: number;
}

export interface EmailSidebarItem {
  iconName: DynamicIconNameType;
  name: string;
  unreadCount: number;
}

export interface EmailSidebarItems {
  folders: Array<EmailSidebarItem>;
  labels: Array<EmailSidebarItem>;
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
  handleSetRead: (email: EmailType) => void;
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
    }
  | {
      type: "setRead";
      email: EmailType;
    };
