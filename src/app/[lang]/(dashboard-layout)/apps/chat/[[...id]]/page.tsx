import { ChatBox } from "../_components/chat-box";

export default async function AppsPage() {
  return (
    <ChatBox
      currentUser={{
        id: "1",
        name: "John Doe",
        avatar: "/images/avatars/01.png",
        status: "ONLINE",
      }}
    />
  );
}
