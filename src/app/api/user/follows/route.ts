import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const follows = await prisma.memorialFollow.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      memorial: {
        select: {
          id: true,
          slug: true,
          name: true,
          birthday: true,
          dateOfDeath: true,
          placeOfDeath: true,
          memorialPicture: true,
          createdAt: true,
          disabled: true,
        },
      },
    },
  });

  const memorials = follows
    .map((f) => f.memorial)
    .filter((m) => !m.disabled);

  return NextResponse.json(memorials);
});
