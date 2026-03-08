import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async () => {
  const { error } = await requireAdmin();
  if (error) return error;

  const memorials = await prisma.memorial.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      disabled: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { memories: { where: { status: "ACCEPTED" } } } },
    },
  });

  return NextResponse.json(memorials);
});
