import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

export const PATCH = withHandler(async (
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
  const { imageIds } = body;

  if (!Array.isArray(imageIds)) {
    return NextResponse.json(
      { error: "imageIds must be an array" },
      { status: 400 }
    );
  }

  if (imageIds.length > 500) {
    return NextResponse.json({ error: "Too many items" }, { status: 400 });
  }

  if (!imageIds.every((id: unknown) => typeof id === "string" && id.length > 0)) {
    return NextResponse.json({ error: "Invalid imageIds" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      imageIds.map((imageId: string, index: number) =>
        prisma.image.update({
          where: { id: imageId, album: { memorialId: id } },
          data: { order: index },
        })
      )
    );
  } catch {
    return NextResponse.json({ error: "Invalid imageIds" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
});
