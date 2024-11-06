"use server";

const chatData = [
  {
    id: "chat_1",
    chatGroup: { name: "General Group" },
    messages: [
      {
        id: "msg_12",
        senderId: "1",
        text: "Pretty good! Just getting started with the day.",
        createdAt: new Date("2024-10-31T10:03:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_11",
        senderId: "2",
        text: "How's everyone doing today?",
        createdAt: new Date("2024-10-31T10:02:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_2",
        senderId: "2",
        text: "Hey John!",
        createdAt: new Date("2024-10-31T10:01:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_1",
        senderId: "1",
        text: "Hello everyone!",
        createdAt: new Date("2024-10-31T10:00:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
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
    id: "chat_2",
    chatGroup: null,
    messages: [
      {
        id: "msg_14",
        senderId: "1",
        text: "Great! Let's keep it that way.",
        createdAt: new Date("2024-10-31T10:08:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "DELIVERED",
      },
      {
        id: "msg_13",
        senderId: "2",
        text: "They look good! I think we're on track.",
        createdAt: new Date("2024-10-31T10:07:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_4",
        senderId: "1",
        text: "Yes, I checked them this morning.",
        createdAt: new Date("2024-10-31T10:06:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "DELIVERED",
      },
      {
        id: "msg_3",
        senderId: "2",
        text: "Hey, did you see the updates?",
        createdAt: new Date("2024-10-31T10:05:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
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
    chatGroup: { name: "Work Team" },
    messages: [
      {
        id: "msg_16",
        senderId: "4",
        text: "Sure! I'll prepare that.",
        createdAt: new Date("2024-10-31T10:13:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "DELIVERED",
      },
      {
        id: "msg_15",
        senderId: "3",
        text: "Can you send out the agenda before then?",
        createdAt: new Date("2024-10-31T10:12:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "DELIVERED",
      },
      {
        id: "msg_6",
        senderId: "4",
        text: "Got it! I'll be there.",
        createdAt: new Date("2024-10-31T10:11:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "DELIVERED",
      },
      {
        id: "msg_5",
        senderId: "3",
        text: "Meeting at 3 PM tomorrow.",
        createdAt: new Date("2024-10-31T10:10:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "DELIVERED",
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
    chatGroup: null,
    messages: [
      {
        id: "msg_18",
        senderId: "3",
        text: "Sounds good! I'll see you then.",
        createdAt: new Date("2024-10-31T10:18:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_17",
        senderId: "1",
        text: "How about 1 PM?",
        createdAt: new Date("2024-10-31T10:17:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_8",
        senderId: "3",
        text: "Sure! What time?",
        createdAt: new Date("2024-10-31T10:16:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_7",
        senderId: "1",
        text: "Let’s grab lunch later?",
        createdAt: new Date("2024-10-31T10:15:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
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
  {
    id: "chat_5",
    chatGroup: null,
    messages: [
      {
        id: "msg_20",
        senderId: "1",
        text: "Nice! I've heard good things about it.",
        createdAt: new Date("2024-10-31T10:23:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "SENT",
      },
      {
        id: "msg_19",
        senderId: "2",
        text: "I went to that new restaurant in town.",
        createdAt: new Date("2024-10-31T10:22:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
      },
      {
        id: "msg_10",
        senderId: "1",
        text: "It was great! Went hiking.",
        createdAt: new Date("2024-10-31T10:21:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "SENT",
      },
      {
        id: "msg_9",
        senderId: "2",
        text: "How was your weekend?",
        createdAt: new Date("2024-10-31T10:20:00Z"),
        attachments: [],
        voiceMessage: null,
        status: "READ",
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
];

export async function getChatData(chatId: string) {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = chatData.find((chat) => chat.id === chatId);
        resolve(result);
      }, 200);
    });
  } catch (error) {
    console.error("Error fetching chat data for chat ID:", chatId, error);
    throw new Error(
      "An unexpected issue occurred. If this persists, please contact support."
    );
  }
}
