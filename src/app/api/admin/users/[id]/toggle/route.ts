import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

export const PATCH = withHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  // Prevent admin from disabling themselves
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot disable yourself" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { disabled: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { disabled: !user.disabled },
  });

  return NextResponse.json({ id: updated.id, disabled: updated.disabled });
});
