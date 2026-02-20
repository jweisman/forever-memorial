import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import { Prisma } from "@/generated/prisma/client";

type MemorialRow = {
  id: string;
  slug: string;
  name: string;
  placeOfDeath: string | null;
  dateOfDeath: Date;
  birthday: Date | null;
  memorialPicture: string | null;
};

export async function GET(request: NextRequest) {
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
    SELECT id, slug, name, "placeOfDeath", "dateOfDeath", birthday, "memorialPicture"
    FROM memorials
    WHERE disabled = false
      AND (name ILIKE ${"%" + q + "%"} OR similarity(name, ${q}) > 0.1)
    ORDER BY similarity(name, ${q}) DESC
    LIMIT ${limit}
  `;

  const results = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      placeOfDeath: row.placeOfDeath,
      dateOfDeath: row.dateOfDeath,
      birthday: row.birthday,
      pictureUrl: row.memorialPicture
        ? await generateViewUrl(row.memorialPicture)
        : null,
    }))
  );

  return NextResponse.json(results);
}
