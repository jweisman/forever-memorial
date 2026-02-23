import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

async function verifyOwnership(memorialId: string, userId: string) {
  const memorial = await prisma.memorial.findUnique({
    where: { id: memorialId },
    select: { ownerId: true },
  });
  return memorial?.ownerId === userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; eulogyId: string }> }
) {
  const { id, eulogyId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  if (!(await verifyOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eulogy = await prisma.eulogy.findUnique({
    where: { id: eulogyId },
    select: { memorialId: true },
  });

  if (!eulogy || eulogy.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.text !== undefined) {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "Eulogy text is required" },
        { status: 400 }
      );
    }
    data.text = text;
  }

  if (body.deliveredBy !== undefined) {
    const deliveredBy =
      typeof body.deliveredBy === "string" ? body.deliveredBy.trim() : "";
    if (!deliveredBy) {
      return NextResponse.json(
        { error: "Delivered by is required" },
        { status: 400 }
      );
    }
    data.deliveredBy = deliveredBy;
  }

  if (body.relation !== undefined) {
    data.relation = body.relation?.trim() || null;
  }

  const updated = await prisma.eulogy.update({
    where: { id: eulogyId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; eulogyId: string }> }
) {
  const { id, eulogyId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  if (!(await verifyOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eulogy = await prisma.eulogy.findUnique({
    where: { id: eulogyId },
    select: { memorialId: true },
  });

  if (!eulogy || eulogy.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.eulogy.delete({ where: { id: eulogyId } });

  return NextResponse.json({ success: true });
}
