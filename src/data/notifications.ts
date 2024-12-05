import type { NotificationType } from "@/types";

export const notificationData: NotificationType = {
  unreadCount: 100,
  notifications: [
    {
      id: "1",
      iconName: "MessageSquare",
      content: "You have requested to withdrawal",
      url: "",
      date: new Date("2024-12-03T10:00:00Z"),
      isRead: false,
    },
    {
      id: "2",
      iconName: "UserPlus",
      content: "A new user added in Trezo",
      url: "",
      date: new Date("2024-12-03T09:00:00Z"),
      isRead: false,
    },
    {
      id: "3",
      iconName: "ArrowUpRight",
      content: "You have requested to withdrawal",
      url: "",
      date: new Date("2024-12-02T12:00:00Z"),
      isRead: true,
    },
  ],
};
