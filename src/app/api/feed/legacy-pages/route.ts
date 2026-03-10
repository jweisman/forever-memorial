import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import { withHandler } from "@/lib/api-error";

const DEFAULT_TAKE = 5;
const MAX_TAKE = 20;

export const GET = withHandler(async (request: Request) => {
  const url = new URL(request.url);
  const skip = Math.max(0, parseInt(url.searchParams.get("skip") ?? "0", 10) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, parseInt(url.searchParams.get("take") ?? String(DEFAULT_TAKE), 10) || DEFAULT_TAKE));

  const [pages, total] = await Promise.all([
    prisma.memorial.findMany({
      where: { disabled: false },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        slug: true,
        name: true,
        birthday: true,
        dateOfDeath: true,
        placeOfDeath: true,
        memorialPicture: true,
        updatedAt: true,
      },
    }),
    prisma.memorial.count({ where: { disabled: false } }),
  ]);

  const items = await Promise.all(
    pages.map(async (p) => ({
      ...p,
      pictureUrl: p.memorialPicture ? await generateViewUrl(p.memorialPicture) : null,
    }))
  );

  return NextResponse.json({ items, total, skip, take });
});
