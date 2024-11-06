import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      name: "John Doe",
      username: "john_doe",
      email: "john.doe@example.com",
      password: "StrongPass123",
      status: "ONLINE",
      avatar: "/images/avatars/01.png",
      preferences: {
        theme: "ZINC",
        mode: "DARK",
        radius: "0.5",
        layout: "VERTICAL",
        direction: "LTR",
      },
    },
    {
      name: "Jane Smith",
      username: "jane_smith",
      email: "jane.smith@example.com",
      password: "StrongPass456",
      status: "IDLE",
      avatar: "/images/avatars/02.png",
      preferences: {
        theme: "BLUE",
        mode: "LIGHT",
        radius: "1.0",
        layout: "HORIZONTAL",
        direction: "RTL",
      },
    },
    {
      name: "Michael Johnson",
      username: "michael.johnson",
      email: "michael.johnson@example.com",
      password: "StrongPass789",
      status: "DO NOT DISTURB",
      avatar: "/images/avatars/03.png",
      preferences: {
        theme: "RED",
        mode: "DARK",
        radius: "0.3",
        layout: "VERTICAL",
        direction: "LTR",
      },
    },
    {
      name: "Emily Davis",
      username: "emily_davis",
      email: "emily.davis@example.com",
      password: "StrongPass101",
      status: "INVISIBLE",
      avatar: "/images/avatars/04.png",
      preferences: {
        theme: "VIOLET",
        mode: "LIGHT",
        radius: "0.75",
        layout: "HORIZONTAL",
        direction: "LTR",
      },
    },
    {
      name: "Sophia Brown",
      username: "sophia_brown",
      email: "sophia.brown@example.com",
      password: "StrongPass112",
      status: "ONLINE",
      avatar: "/images/avatars/05.png",
      preferences: {
        theme: "GREEN",
        mode: "DARK",
        radius: "1.0",
        layout: "VERTICAL",
        direction: "RTL",
      },
    },
  ];

  // Upsert users
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: new Date(),
        password: await bcrypt.hash(user.password, 10),
        status: user.status,
        avatar: user.avatar,
        preferences: {
          create: {
            theme: user.preferences.theme,
            mode: user.preferences.mode,
            radius: user.preferences.radius,
            layout: user.preferences.layout,
            direction: user.preferences.direction,
          },
        },
      },
    });
  }

  console.log("User seed data created successfully");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
