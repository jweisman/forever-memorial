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
  const { albumIds } = body;

  if (!Array.isArray(albumIds)) {
    return NextResponse.json(
      { error: "albumIds must be an array" },
      { status: 400 }
    );
  }

  if (albumIds.length > 500) {
    return NextResponse.json({ error: "Too many items" }, { status: 400 });
  }

  if (!albumIds.every((aid: unknown) => typeof aid === "string" && aid.length > 0)) {
    return NextResponse.json({ error: "Invalid albumIds" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      albumIds.map((albumId: string, index: number) =>
        prisma.album.update({
          where: { id: albumId, memorialId: id },
          data: { order: index },
        })
      )
    );
  } catch {
    return NextResponse.json({ error: "Invalid albumIds" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
