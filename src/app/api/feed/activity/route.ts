import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

const DEFAULT_TAKE = 5;
const MAX_TAKE = 20;

export const GET = withHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const skip = Math.max(0, parseInt(url.searchParams.get("skip") ?? "0", 10) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, parseInt(url.searchParams.get("take") ?? String(DEFAULT_TAKE), 10) || DEFAULT_TAKE));

  const userId = session.user.id;

  // Fetch ACCEPTED memories from pages the user follows or owns
  const memories = await prisma.memory.findMany({
    where: {
      status: "ACCEPTED",
      memorial: {
        disabled: false,
        OR: [
          { ownerId: userId },
          { followers: { some: { userId } } },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      name: true,
      withholdName: true,
      relation: true,
      text: true,
      createdAt: true,
      memorial: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  const total = await prisma.memory.count({
    where: {
      status: "ACCEPTED",
      memorial: {
        disabled: false,
        OR: [
          { ownerId: userId },
          { followers: { some: { userId } } },
        ],
      },
    },
  });

  const items = memories.map((m) => ({
    ...m,
    name: m.withholdName ? null : m.name,
  }));

  return NextResponse.json({ items, total, skip, take });
});
