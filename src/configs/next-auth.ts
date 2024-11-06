import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/prisma";

import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string | null;
      name: string;
      avatar: string | null;
      status: string;
    };
  }

  interface User {
    id: string;
    email: string | null;
    name: string;
    avatar: string | null;
    status: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string | null;
    name: string;
    avatar: string | null;
    status: string;
  }
}

export const nextAuthOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        try {
          const res = await fetch(`${process.env.API_URL}/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const payload = await res.json();

          if (res.status >= 400) {
            throw new Error(payload?.message ?? "An unknown error occurred.");
          }

          return payload;
        } catch (e: unknown) {
          throw new Error(
            e instanceof Error ? e.message : "An unknown error occurred."
          );
        }
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.avatar = user.avatar;
        token.email = user.email;
        token.status = user.status;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.avatar = token.avatar;
        session.user.email = token.email;
        token.status = token.status;
      }

      return session;
    },
  },
};
