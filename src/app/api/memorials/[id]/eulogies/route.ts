import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const eulogies = await prisma.eulogy.findMany({
    where: { memorialId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(eulogies);
});

export const POST = withHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const deliveredBy =
    typeof body.deliveredBy === "string" ? body.deliveredBy.trim() : "";

  if (!text) {
    return NextResponse.json(
      { error: "Eulogy text is required" },
      { status: 400 }
    );
  }

  if (!deliveredBy) {
    return NextResponse.json(
      { error: "Delivered by is required" },
      { status: 400 }
    );
  }

  // Get next order value
  const maxOrder = await prisma.eulogy.aggregate({
    where: { memorialId: id },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const eulogy = await prisma.eulogy.create({
    data: {
      memorialId: id,
      text,
      deliveredBy,
      relation: body.relation?.trim() || null,
      order: nextOrder,
    },
  });

  return NextResponse.json(eulogy, { status: 201 });
});
