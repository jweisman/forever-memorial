import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const memories = await prisma.memory.findMany({
    where: { memorialId: id, status: "ACCEPTED" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      text: true,
      createdAt: true,
    },
  });

  return NextResponse.json(memories);
});
