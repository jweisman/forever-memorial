import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteS3Object,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";

type Params = { id: string; memoryId: string; imageId: string };

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  const { id, memoryId, imageId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { memorial: { select: { ownerId: true } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    memory.submitterId !== session.user.id &&
    memory.memorial.ownerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const image = await prisma.memoryImage.findUnique({
    where: { id: imageId },
  });

  if (!image || image.memoryId !== memoryId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete variant S3 objects (thumb + full)
  for (const key of [thumbKeyFromBase(image.s3Key), fullKeyFromBase(image.s3Key)]) {
    try {
      await deleteS3Object(key);
    } catch {
      // Ignore S3 deletion errors
    }
  }

  await prisma.memoryImage.delete({ where: { id: imageId } });

  return NextResponse.json({ success: true });
}
