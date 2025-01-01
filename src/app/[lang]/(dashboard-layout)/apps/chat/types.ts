export interface ChatContextType {
  chatState: ChatStateType;
  isChatSidebarOpen: boolean;
  setIsChatSidebarOpen: (val: boolean) => void;
  handleSelectChat: (chat: ChatType) => void;
  handleAddTextMessage: (text: string) => void;
  handleAddImagesMessage: (images: File[]) => void;
  handleAddFilesMessage: (files: File[]) => void;
  handleSetUnreadCount: () => void;
}

export type ChatStatusType = "READ" | "DELIVERED" | "SENT" | null;

export interface FileType {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MessageType {
  id: string;
  senderId: string;
  text?: string;
  images?: FileType[];
  files?: FileType[];
  voiceMessage?: FileType;
  status: string;
  createdAt: Date;
}

export type NewMessageType = Omit<
  MessageType,
  "id" | "senderId" | "createdAt" | "images" | "files" | "voiceMessage"
> & {
  images?: File[];
  files?: File[];
  voiceMessage?: File;
};

export interface UserType {
  id: string;
  name: string;
  avatar?: string;
  status: string;
}

export interface LastMessageType {
  content: string;
  createdAt: Date;
}

export interface ChatType {
  id: string;
  lastMessage: LastMessageType;
  name: string;
  avatar?: string;
  status?: string;
  messages: MessageType[];
  users: UserType[];
  typingUsers: UserType[];
  unreadCount?: number;
}

export interface ChatStateType {
  chats: ChatType[];
  selectedChat?: ChatType | null;
}

export type ChatActionType =
  | {
      type: "addTextMessage";
      text: string;
    }
  | {
      type: "addImagesMessage";
      images: File[];
    }
  | {
      type: "addFilesMessage";
      files: File[];
    }
  | {
      type: "setUnreadCount";
    }
  | {
      type: "selectChat";
      chat: ChatType;
    };
