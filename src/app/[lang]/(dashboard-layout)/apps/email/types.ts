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
  emails: EmailType[];
  totalPages: number;
  currentPage: number;
  totalEmails: number;
}

export interface EmailSidebarLabel {
  iconName: DynamicIconNameType;
  label: string;
  param: string;
  unreadCount: number;
}
