import { userData } from "@/data/user";

import { ChatBox } from "../_components/chat-box";
import { ChatWrapper } from "../_components/chat-wrapper";

export default function ChatBoxPage() {
  return (
    <ChatWrapper>
      <ChatBox user={userData} />
    </ChatWrapper>
  );
}
