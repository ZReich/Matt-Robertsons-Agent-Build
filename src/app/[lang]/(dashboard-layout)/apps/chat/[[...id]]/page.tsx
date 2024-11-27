import { userData } from "@/data/user";

import { ChatBox } from "../_components/chat-box";

export default async function AppsPage() {
  const user = userData;

  return <ChatBox user={user} />;
}
