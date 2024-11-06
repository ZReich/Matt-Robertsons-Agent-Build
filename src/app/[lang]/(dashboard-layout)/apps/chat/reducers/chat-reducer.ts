import type { ChatState, MessageType, ChatAction } from "../types";

export const ChatReducer = (
  state: ChatState,
  action: ChatAction
): ChatState => {
  switch (action.type) {
    case "addTextMessage": {
      if (!state.selectedChat) {
        return state;
      }

      const newMessage: MessageType = {
        id: crypto.randomUUID(),
        senderId: "1",
        text: action.text,
        status: "DELIVERED",
        createdAt: new Date(),
      };

      const { id, messages } = state.selectedChat;

      const updatedChat = {
        ...state.selectedChat,
        lastMessage: {
          content: action.text,
          createdAt: newMessage.createdAt,
        },
        messages: [newMessage, ...messages],
      };

      const updatedChats = state.chats.map((chat) =>
        chat.id === id ? updatedChat : chat
      );

      return { ...state, chats: updatedChats };
    }

    case "addImagesMessage": {
      if (!state.selectedChat) {
        return state;
      }

      const images = action.images.map((image) => {
        return {
          id: crypto.randomUUID(),
          name: image.name,
          type: image.type,
          size: image.size,
          url: URL.createObjectURL(image),
        };
      });

      const newMessage: MessageType = {
        id: crypto.randomUUID(),
        senderId: "1",
        images: images,
        status: "DELIVERED",
        createdAt: new Date(),
      };

      const { id, messages } = state.selectedChat;

      const updatedChat = {
        ...state.selectedChat,
        lastMessage: {
          content: action.images.length > 1 ? "Images" : "Image",
          createdAt: newMessage.createdAt,
        },
        messages: [newMessage, ...messages],
      };

      const updatedChats = state.chats.map((chat) =>
        chat.id === id ? updatedChat : chat
      );

      return { ...state, chats: updatedChats };
    }

    case "addFilesMessage": {
      if (!state.selectedChat) {
        return state;
      }

      const files = action.files.map((file) => {
        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: URL.createObjectURL(file),
        };
      });

      const newMessage: MessageType = {
        id: crypto.randomUUID(),
        senderId: "1",
        files: files,
        status: "DELIVERED",
        createdAt: new Date(),
      };

      const { id, messages } = state.selectedChat;

      const updatedChat = {
        ...state.selectedChat,
        lastMessage: {
          content: action.files.length > 1 ? "Files" : "File",
          createdAt: newMessage.createdAt,
        },
        messages: [newMessage, ...messages],
      };

      const updatedChats = state.chats.map((chat) =>
        chat.id === id ? updatedChat : chat
      );

      return { ...state, chats: updatedChats };
    }

    case "setUnreadCount": {
      if (!state.selectedChat) {
        return state;
      }

      const { id } = state.selectedChat;

      const updatedChat = {
        ...state.selectedChat,
        unreadCount: 0,
      };

      const updatedChats = state.chats.map((chat) =>
        chat.id === id ? updatedChat : chat
      );

      return { ...state, chats: updatedChats };
    }

    case "selectChat": {
      return { ...state, selectedChat: action.chat };
    }

    default:
      return state;
  }
};
