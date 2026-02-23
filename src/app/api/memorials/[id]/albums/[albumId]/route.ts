import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteS3Object,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; albumId: string }> }
) {
  const { id, albumId } = await params;
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

  if (!memorial || memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { memorialId: true },
  });

  if (!album || album.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Album name is required" },
      { status: 400 }
    );
  }

  const updated = await prisma.album.update({
    where: { id: albumId },
    data: { name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; albumId: string }> }
) {
  const { id, albumId } = await params;
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

  if (!memorial || memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all images in the album to clean up S3
  const images = await prisma.image.findMany({
    where: { albumId },
    select: { s3Key: true },
  });

  // Delete S3 variant objects (thumb + full for each image)
  for (const image of images) {
    for (const key of [thumbKeyFromBase(image.s3Key), fullKeyFromBase(image.s3Key)]) {
      try {
        await deleteS3Object(key);
      } catch {
        // Ignore individual S3 deletion errors
      }
    }
  }

  // Cascade delete handles images in DB
  await prisma.album.delete({ where: { id: albumId } });

  return NextResponse.json({ success: true });
}
