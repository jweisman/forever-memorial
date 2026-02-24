import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteS3Object,
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { sendNotification, memoryResubmittedEmail } from "@/lib/email";

type Params = { id: string; memoryId: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  const { id, memoryId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { images: true, memorial: { select: { ownerId: true } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only submitter or memorial owner can view
  if (
    memory.submitterId !== session.user.id &&
    memory.memorial.ownerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const images = await Promise.all(
    memory.images.map(async (img) => ({
      ...img,
      thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
      url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
    }))
  );

  return NextResponse.json({ ...memory, images });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
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
    include: { memorial: { select: { ownerId: true, name: true, owner: { select: { email: true } } } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = memory.memorial.ownerId === session.user.id;
  const isSubmitter = memory.submitterId === session.user.id;

  // Submitter can only edit RETURNED memories; owner can edit any
  if (isSubmitter && !isOwner && memory.status !== "RETURNED") {
    return NextResponse.json(
      { error: "You can only edit returned memories" },
      { status: 403 }
    );
  }

  if (!isSubmitter && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.text === "string" && body.text.trim()) {
    data.text = body.text.trim();
  }
  if (typeof body.relation === "string") {
    data.relation = body.relation.trim() || null;
  }
  if (typeof body.withholdName === "boolean") {
    data.withholdName = body.withholdName;
  }

  // If submitter edits a RETURNED memory, reset to PENDING
  const isResubmission = isSubmitter && memory.status === "RETURNED";
  if (isResubmission) {
    data.status = "PENDING";
    data.returnMessage = null;
  }

  const updated = await prisma.memory.update({
    where: { id: memoryId },
    data,
  });

  // Notify memorial owner about resubmission
  if (isResubmission && memory.memorial.owner.email) {
    const dashboardUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/dashboard`;
    const email = memoryResubmittedEmail({
      memorialName: memory.memorial.name,
      submitterName: memory.name,
      dashboardUrl,
    });
    sendNotification({ to: memory.memorial.owner.email, ...email });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
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
    include: { images: true, memorial: { select: { ownerId: true } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = memory.memorial.ownerId === session.user.id;
  const isSubmitter = memory.submitterId === session.user.id;

  // Owner can delete any; submitter can delete own PENDING, ACCEPTED, or RETURNED
  if (!isOwner && !(isSubmitter && (memory.status === "PENDING" || memory.status === "ACCEPTED" || memory.status === "RETURNED"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clean up S3 variant objects (thumb + full for each image)
  for (const img of memory.images) {
    for (const key of [thumbKeyFromBase(img.s3Key), fullKeyFromBase(img.s3Key)]) {
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
