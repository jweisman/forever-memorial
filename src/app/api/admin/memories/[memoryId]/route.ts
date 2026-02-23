import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  deleteS3Object,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { memoryId } = await params;

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { images: true },
  });
  if (!memory) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clean up S3 variant objects (thumb + full for each image)
  for (const img of memory.images) {
    for (const key of [
      thumbKeyFromBase(img.s3Key),
      fullKeyFromBase(img.s3Key),
    ]) {
      try {
        await deleteS3Object(key);
      } catch {
        // Ignore S3 deletion errors
      }
    }
  }

  await prisma.memory.delete({ where: { id: memoryId } });

  return NextResponse.json({ success: true });
}
