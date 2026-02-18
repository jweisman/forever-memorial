import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object, generateViewUrl } from "@/lib/s3-helpers";

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
      url: await generateViewUrl(img.s3Key),
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

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { memorial: { select: { ownerId: true } } },
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
  if (isSubmitter && memory.status === "RETURNED") {
    data.status = "PENDING";
    data.returnMessage = null;
  }

  const updated = await prisma.memory.update({
    where: { id: memoryId },
    data,
  });

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

  // Clean up S3 objects
  for (const img of memory.images) {
    try {
      await deleteS3Object(img.s3Key);
    } catch {
      // Ignore S3 deletion errors
    }
  }

  await prisma.memory.delete({ where: { id: memoryId } });

  return NextResponse.json({ success: true });
}
