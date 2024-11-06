"use server";

import { ChatType } from "../types";

const chatsData = [
  {
    id: "chat_1",
    chatGroup: { name: "General Group", avatar: "/images/avatars/group.png" },
    lastMessage: {
      content: "Hello everyone!",
      createdAt: new Date("2024-10-31T10:03:00Z"),
    },
    name: "General Group",
    avatar: "/images/avatars/group.png",
    messages: [
      {
        id: "msg_12",
        senderId: "2",
        text: "Pretty good! Just getting started with the day.",
        createdAt: new Date("2024-10-31T10:03:00Z"),
        status: "DELIVERED",
        type: "TEXT",
      },
      {
        id: "msg_11",
        senderId: "1",
        text: "How's everyone doing today?",
        createdAt: new Date("2024-10-31T10:02:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_2",
        senderId: "1",
        text: "Hey John!",
        createdAt: new Date("2024-10-31T10:01:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_1",
        senderId: "2",
        text: "Hello everyone!",
        createdAt: new Date("2024-10-31T10:00:00Z"),
        status: "READ",
        type: "TEXT",
      },
    ],
    users: [
      {
        id: "1",
        name: "John Doe",
        avatar: "/images/avatars/01.png",
        status: "ONLINE",
      },
      {
        id: "2",
        name: "Jane Smith",
        avatar: "/images/avatars/02.png",
        status: "IDLE",
      },
    ],
    typingUsers: [],
    unreadCount: 1,
  },
  {
    id: "chat_2",
    lastMessage: {
      content: "Hey, did you see the updates?",
      createdAt: new Date("2024-10-31T10:08:00Z"),
    },
    name: "Jane Smith",
    avatar: "/images/avatars/02.png",
    status: "IDLE",
    messages: [
      {
        id: "msg_14",
        senderId: "1",
        text: "Great! Let's keep it that way.",
        createdAt: new Date("2024-10-31T10:08:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_13",
        senderId: "2",
        text: "They look good! I think we're on track.",
        createdAt: new Date("2024-10-31T10:07:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_4",
        senderId: "1",
        text: "Yes, I checked them this morning.",
        createdAt: new Date("2024-10-31T10:06:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_3",
        senderId: "2",
        text: "Hey, did you see the updates?",
        createdAt: new Date("2024-10-31T10:05:00Z"),
        status: "READ",
        type: "TEXT",
      },
    ],
    users: [
      {
        id: "1",
        name: "John Doe",
        avatar: "/images/avatars/01.png",
        status: "ONLINE",
      },
      {
        id: "2",
        name: "Jane Smith",
        avatar: "/images/avatars/02.png",
        status: "IDLE",
      },
    ],
    typingUsers: [],
  },
  {
    id: "chat_3",
    chatGroup: { name: "Work Team", avatar: "/images/avatars/work.png" },
    lastMessage: {
      content: "Meeting at 3 PM tomorrow.",
      createdAt: new Date("2024-10-31T10:13:00Z"),
    },
    name: "Work Team",
    avatar: "/images/avatars/work.png",
    messages: [
      {
        id: "msg_16",
        senderId: "4",
        text: "Sure! I'll prepare that.",
        createdAt: new Date("2024-10-31T10:13:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_15",
        senderId: "3",
        text: "Can you send out the agenda before then?",
        createdAt: new Date("2024-10-31T10:12:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_6",
        senderId: "4",
        text: "Got it! I'll be there.",
        createdAt: new Date("2024-10-31T10:11:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_5",
        senderId: "3",
        text: "Meeting at 3 PM tomorrow.",
        createdAt: new Date("2024-10-31T10:10:00Z"),
        status: "READ",
        type: "TEXT",
      },
    ],
    users: [
      {
        id: "3",
        name: "Michael Johnson",
        avatar: "/images/avatars/03.png",
        status: "ONLINE",
      },
      {
        id: "4",
        name: "Emily Davis",
        avatar: "/images/avatars/04.png",
        status: "DO NOT DISTURB",
      },
    ],
    typingUsers: [],
  },
  {
    id: "chat_4",
    lastMessage: {
      content: "Let’s grab lunch later?",
      createdAt: new Date("2024-10-31T10:18:00Z"),
    },
    name: "Michael Johnson",
    avatar: "/images/avatars/03.png",
    status: "ONLINE",
    messages: [
      {
        id: "msg_18",
        senderId: "3",
        text: "Sounds good! I'll see you then.",
        createdAt: new Date("2024-10-31T10:18:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_17",
        senderId: "1",
        text: "How about 1 PM?",
        createdAt: new Date("2024-10-31T10:17:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_8",
        senderId: "3",
        text: "Sure! What time?",
        createdAt: new Date("2024-10-31T10:16:00Z"),
        status: "READ",
        type: "TEXT",
      },
      {
        id: "msg_7",
        senderId: "1",
        text: "Let’s grab lunch later?",
        createdAt: new Date("2024-10-31T10:15:00Z"),
        status: "READ",
        type: "TEXT",
      },
    ],
    users: [
      {
        id: "1",
        name: "John Doe",
        avatar: "/images/avatars/01.png",
        status: "ONLINE",
      },
      {
        id: "3",
        name: "Michael Johnson",
        avatar: "/images/avatars/03.png",
        status: "ONLINE",
      },
    ],
    typingUsers: [],
  },
];

export async function getChatsData(): Promise<ChatType[]> {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(chatsData);
      }, 200);
    });
  } catch (error) {
    console.error("Database Error: Failed to Get chats data:", error);

    throw new Error(
      "An unexpected issue occurred. If this persists, please contact support."
    );
  }
}
