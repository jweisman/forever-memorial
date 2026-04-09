import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload } from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

type Params = { id: string; memoryId: string };

/** POST — Abort a multipart upload for a memory video. */
export const POST = withHandler(async (
  request: Request,
  { params }: { params: Promise<Params> }
) => {
  const { id, memoryId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
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

  const body = await request.json();
  const { uploadId, s3Key } = body;

  if (!uploadId || !s3Key) {
    return NextResponse.json(
      { error: "uploadId and s3Key are required" },
      { status: 400 }
    );
  }

  if (!s3Key.startsWith(`memorials/${id}/memories/${memoryId}/`)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  await abortMultipartUpload(s3Key, uploadId);

  return NextResponse.json({ ok: true });
});
