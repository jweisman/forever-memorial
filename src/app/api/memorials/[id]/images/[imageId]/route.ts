import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object } from "@/lib/s3-helpers";

async function verifyOwnership(memorialId: string, userId: string) {
  const memorial = await prisma.memorial.findUnique({
    where: { id: memorialId },
    select: { ownerId: true },
  });
  return memorial?.ownerId === userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await verifyOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: { album: { select: { memorialId: true } } },
  });

  if (!image || image.album.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updated = await prisma.image.update({
    where: { id: imageId },
    data: { caption: body.caption?.trim() || null },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await verifyOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: { album: { select: { memorialId: true } } },
  });

  if (!image || image.album.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteS3Object(image.s3Key);
  } catch {
    // Ignore S3 deletion errors
  }

  await prisma.image.delete({ where: { id: imageId } });

  return NextResponse.json({ success: true });
}
