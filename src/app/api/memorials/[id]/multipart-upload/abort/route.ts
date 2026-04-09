import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload } from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

/** POST — Abort a multipart upload (cleanup on failure/cancel). */
export const POST = withHandler(async (
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
  const { uploadId, s3Key } = body;

  if (!uploadId || !s3Key) {
    return NextResponse.json(
      { error: "uploadId and s3Key are required" },
      { status: 400 }
    );
  }

  // Validate s3Key belongs to this memorial
  if (!s3Key.startsWith(`memorials/${id}/`)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  await abortMultipartUpload(s3Key, uploadId);

  return NextResponse.json({ ok: true });
});
