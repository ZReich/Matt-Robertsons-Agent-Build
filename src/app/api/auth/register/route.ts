import { hash } from "bcryptjs";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { NextResponse } from "next/server";

const FormSchema = z.object({
  firstName: z.string().min(2, {
    message: "Fisrt name must contain at least 2 character(s)",
  }),
  lastName: z.string().min(2, {
    message: "Last name must contain at least 2 character(s)",
  }),
  username: z.string().min(3, {
    message: "Usernmae must contain at least 3 character(s)",
  }),
  email: z
    .string()
    .email()
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, {
      message: "Password must contain at least 8 character(s)",
    })
    .regex(/(?=.*[a-zA-Z])/, {
      message: "Password must contain at least one letter.",
    })
    .regex(/(?=.*[0-9])/, {
      message: "Password must contain at least one number.",
    }),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsedData = FormSchema.safeParse(body);

  if (!parsedData.success) {
    return NextResponse.json(parsedData.error, { status: 400 });
  }

  const { firstName, lastName, username, email, password } = parsedData.data;

  try {
    // Check if the user already exists
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 409 }
      );
    }

    // Hash the password
    const hashedPassword = await hash(password, 10);

    const newUser = await db.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        username,
        email,
        password: hashedPassword,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error creating user" }, { status: 500 });
  }
}
