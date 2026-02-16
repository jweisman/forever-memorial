import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  await prisma.$transaction(
    eulogyIds.map((eulogyId: string, index: number) =>
      prisma.eulogy.update({
        where: { id: eulogyId },
        data: { order: index },
      })
    )
  );

  return NextResponse.json({ success: true });
}
