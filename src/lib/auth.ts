import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/configs/next-auth";

export async function getSession() {
  return await getServerSession(nextAuthOptions);
}

export async function authenticateUser() {
  const session = await getSession();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized user.");
  }

  return session.user;
}
