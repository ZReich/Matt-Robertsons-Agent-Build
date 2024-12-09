import { userData } from "@/data/user";

import { ChatBox } from "../_components/chat-box";

export default function ChatBoxPage() {
  return <ChatBox user={userData} />;
}
