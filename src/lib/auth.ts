import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/configs/next-auth";

export async function authenticateUser() {
  const session = await getServerSession(nextAuthOptions);

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized user.");
  }

  return session.user;
}
