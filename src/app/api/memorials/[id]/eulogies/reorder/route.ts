import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const eulogyIds = body.eulogyIds;

  if (!Array.isArray(eulogyIds)) {
    return NextResponse.json(
      { error: "eulogyIds must be an array" },
      { status: 400 }
    );
  }

  if (eulogyIds.length > 500) {
    return NextResponse.json({ error: "Too many items" }, { status: 400 });
  }

  if (!eulogyIds.every((eid: unknown) => typeof eid === "string" && eid.length > 0)) {
    return NextResponse.json({ error: "Invalid eulogyIds" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      eulogyIds.map((eulogyId: string, index: number) =>
        prisma.eulogy.update({
          where: { id: eulogyId, memorialId: id },
          data: { order: index },
        })
      )
    );
  } catch {
    return NextResponse.json({ error: "Invalid eulogyIds" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
