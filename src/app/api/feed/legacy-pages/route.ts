import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateViewUrl, thumbKeyFromBase } from "@/lib/s3-helpers";
import { getHebrewDeathDate } from "@/lib/hebrewDate";
import { withHandler } from "@/lib/api-error";

const DEFAULT_TAKE = 5;
const MAX_TAKE = 20;

export const GET = withHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const url = new URL(request.url);
  const skip = Math.max(0, parseInt(url.searchParams.get("skip") ?? "0", 10) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, parseInt(url.searchParams.get("take") ?? String(DEFAULT_TAKE), 10) || DEFAULT_TAKE));

  const filter = url.searchParams.get("filter"); // "owned" | "followed" | null (both)
  const where =
    filter === "owned"
      ? { disabled: false, ownerId: userId }
      : filter === "followed"
        ? { disabled: false, followers: { some: { userId } } }
        : {
            disabled: false,
            OR: [
              { ownerId: userId },
              { followers: { some: { userId } } },
            ],
          };

  const [pages, total] = await Promise.all([
    prisma.memorial.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        slug: true,
        name: true,
        birthday: true,
        dateOfDeath: true,
        deathAfterSunset: true,
        placeOfBirth: true,
        placeOfDeath: true,
        memorialPicture: true,
        updatedAt: true,
      },
    }),
    prisma.memorial.count({ where }),
  ]);

  const items = await Promise.all(
    pages.map(async (p) => ({
      ...p,
      hebrewDate: getHebrewDeathDate(p.dateOfDeath, p.deathAfterSunset, "he"),
      pictureUrl: p.memorialPicture ? await generateViewUrl(thumbKeyFromBase(p.memorialPicture)) : null,
    }))
  );

  return NextResponse.json({ items, total, skip, take });
});
