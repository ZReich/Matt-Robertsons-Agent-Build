import NextAuth from "next-auth";

import { nextAuthOptions } from "@/configs/next-auth";

const handler = NextAuth(nextAuthOptions);

export { handler as GET, handler as POST };
