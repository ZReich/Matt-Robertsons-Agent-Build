import { getServerSession } from "next-auth";
import matcher from "picomatch";

import { authOptions } from "@/configs/next-auth";
import { guestRoutes, protectedRoutes } from "@/configs/auth-routes";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function authenticateUser() {
  const session = await getSession();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized user.");
  }

  return session.user;
}

export const isGuestRoute = matcher(guestRoutes);

export const isProtectedRoute = matcher(protectedRoutes);
