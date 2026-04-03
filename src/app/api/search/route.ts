import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import { getHebrewDeathDate } from "@/lib/hebrewDate";
import { Prisma } from "@/generated/prisma/client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withHandler } from "@/lib/api-error";

type MemorialRow = {
  id: string;
  slug: string;
  name: string;
  placeOfDeath: string | null;
  dateOfDeath: Date;
  deathAfterSunset: boolean;
  birthday: Date | null;
  memorialPicture: string | null;
};

export const GET = withHandler(async (request: NextRequest) => {
  const ip = getClientIp(request);
  const { success } = rateLimit({ key: `search:${ip}`, limit: 30, windowMs: 60_000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = parseInt(
    request.nextUrl.searchParams.get("limit") ?? "5",
    10
  );
  const limit = Math.min(Math.max(limitParam, 1), 20);

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const rows = await prisma.$queryRaw<MemorialRow[]>`
    SELECT id, slug, name, "placeOfDeath", "dateOfDeath", "deathAfterSunset", birthday, "memorialPicture"
    FROM memorials
    WHERE disabled = false
      AND (name ILIKE ${"%" + q + "%"} OR word_similarity(${q}, name) > 0.4)
    ORDER BY word_similarity(${q}, name) DESC
    LIMIT ${limit}
  `;

  const results = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      placeOfDeath: row.placeOfDeath,
      dateOfDeath: row.dateOfDeath,
      hebrewDate: getHebrewDeathDate(row.dateOfDeath, row.deathAfterSunset, "he"),
      pictureUrl: row.memorialPicture
        ? await generateViewUrl(row.memorialPicture)
        : null,
    }))
  );

  return NextResponse.json(results);
});
