import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object } from "@/lib/s3-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { ownerId: true, memorialPicture: true },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (memorial.memorialPicture) {
    try {
      await deleteS3Object(memorial.memorialPicture);
    } catch {
      // Ignore S3 deletion errors
    }
  }

  await prisma.memorial.update({
    where: { id },
    data: { memorialPicture: null },
  });

  return NextResponse.json({ success: true });
}
