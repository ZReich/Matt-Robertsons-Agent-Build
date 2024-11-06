import { EmailList } from "../_components/email-list";
import { Email } from "../types";

import { Archive, Clock, Pencil, Send, Star, Trash2 } from "lucide-react";

export const sidebarListItems = [
  { icon: Archive, label: "Inbox", param: "inbox", unreadCount: 3 },
  { icon: Send, label: "Sent", param: "sent" },
  { icon: Pencil, label: "Draft", param: "draft", unreadCount: 4 },
  { icon: Star, label: "Starred", param: "starred" },
  { icon: Clock, label: "Spam", param: "spam", unreadCount: 2 },
  { icon: Trash2, label: "Trash", param: "trash" },
];

export default function EmailPage({ params }: { params: { list: string } }) {
  const listParam = params.list;

  const emails: Email[] = [
    {
      id: "1",
      name: "Tommy Sicilia",
      subject: "How to Succeed with Your Shopify Store",
      timestamp: "10:46 AM",
      read: false,
      starred: false,
      avatar: "/placeholder.svg?height=32&width=32",
    },
    {
      id: "2",
      name: "Tressa Gass",
      subject: "Please find attached the latest Company Report",
      timestamp: "10:55 AM",
      read: true,
      starred: true,
      avatar: "/placeholder.svg?height=32&width=32",
    },
    {
      id: "3",
      name: "Louetta Esses",
      subject: "Update Can Change Your Personal Life",
      timestamp: "12:04 PM",
      read: true,
      starred: false,
      avatar: "/placeholder.svg?height=32&width=32",
    },
  ];

  const isValidListParam = sidebarListItems.some(
    (item) => item.param === listParam
  );

  if (isValidListParam) {
    if (listParam === "inbox") return <EmailList emails={emails} />;
  }
}
