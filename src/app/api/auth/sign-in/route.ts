import { NextResponse } from "next/server";
import { z } from "zod";

import { userData } from "@/data/user";

const signInSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(250),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsedData = signInSchema.safeParse(body);

  if (!parsedData.success) {
    return NextResponse.json(parsedData.error, { status: 400 });
  }

  const { email, password } = parsedData.data;

  try {
    if (userData.email !== email || userData.password !== password) {
      return NextResponse.json(
        { message: "Invalid email or password", email },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar,
        status: userData.status,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Error signing in:", e);
    return NextResponse.json({ error: "Error signing in" }, { status: 500 });
  }
}
