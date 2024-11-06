import { compare } from "bcryptjs";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { NextResponse } from "next/server";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsedData = signInSchema.safeParse(body);

  if (!parsedData.success) {
    return NextResponse.json(parsedData.error, { status: 400 });
  }

  const { email, password } = parsedData.data;

  try {
    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return NextResponse.json(
        { message: "Invalid email or password", email },
        { status: 401 }
      );
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error signing in" }, { status: 500 });
  }
}
