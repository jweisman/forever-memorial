import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { disabled: true },
  });
  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.memorial.update({
    where: { id },
    data: { disabled: !memorial.disabled },
  });

  return NextResponse.json({ id: updated.id, disabled: updated.disabled });
}
