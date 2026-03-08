import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async () => {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      createdAt: true,
      _count: { select: { memorials: true, submittedMemories: true } },
    },
  });

  return NextResponse.json(users);
});
