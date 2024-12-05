import type { EmailSidebarLabel } from "../types";

export const sidebarLabelsData: EmailSidebarLabel[] = [
  { iconName: "Archive", label: "Inbox", param: "inbox", unreadCount: 3 },
  { iconName: "Send", label: "Sent", param: "sent", unreadCount: 0 },
  { iconName: "Pencil", label: "Draft", param: "draft", unreadCount: 4 },
  { iconName: "Star", label: "Starred", param: "starred", unreadCount: 0 },
  { iconName: "Clock", label: "Spam", param: "spam", unreadCount: 2 },
  { iconName: "Trash2", label: "Trash", param: "trash", unreadCount: 0 },
];
