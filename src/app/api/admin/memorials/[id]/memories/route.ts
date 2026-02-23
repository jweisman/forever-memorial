import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}
