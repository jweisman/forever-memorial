import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { sendNotification, newSubmissionEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");

  // If status param is provided, require auth + ownership (dashboard review)
  if (statusParam) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memorial = await prisma.memorial.findUnique({
      where: { id },
      select: { ownerId: true, name: true, slug: true },
    });

    if (!memorial) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (memorial.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statuses = statusParam.split(",").map((s) => s.trim());

    const memories = await prisma.memory.findMany({
      where: { memorialId: id, status: { in: statuses as never[] } },
      orderBy: { createdAt: "desc" },
      include: { images: true },
    });

    const memoriesWithUrls = await Promise.all(
      memories.map(async (memory) => ({
        ...memory,
        memorial: { name: memorial.name, slug: memorial.slug },
        images: await Promise.all(
          memory.images.map(async (img) => ({
            ...img,
            thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
            url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
          }))
        ),
      }))
    );

    return NextResponse.json(memoriesWithUrls);
  }

  // Public: return only ACCEPTED memories
  const memories = await prisma.memory.findMany({
    where: { memorialId: id, status: "ACCEPTED" },
    orderBy: { createdAt: "asc" },
    include: { images: true },
  });

  const memoriesWithUrls = await Promise.all(
    memories.map(async (memory) => ({
      ...memory,
      name: memory.withholdName ? "Anonymous" : memory.name,
      images: await Promise.all(
        memory.images.map(async (img) => ({
          ...img,
          thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
          url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
        }))
      ),
    }))
  );

  return NextResponse.json(memoriesWithUrls);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ip = getClientIp(request);
  const { success } = rateLimit({ key: `memories:${ip}`, limit: 10, windowMs: 60_000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { id: true, disabled: true, name: true, owner: { select: { email: true } } },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.disabled) {
    return NextResponse.json(
      { error: "This memorial is disabled" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  if (!text) {
    return NextResponse.json(
      { error: "Memory text is required" },
      { status: 400 }
    );
  }

  const memory = await prisma.memory.create({
    data: {
      memorialId: id,
      submitterId: session.user.id,
      name,
      withholdName: body.withholdName === true,
      relation: body.relation?.trim() || null,
      text,
    },
  });

  // Notify memorial owner
  if (memorial.owner.email) {
    const dashboardUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/dashboard`;
    const email = newSubmissionEmail({
      memorialName: memorial.name,
      submitterName: name,
      dashboardUrl,
    });
    sendNotification({ to: memorial.owner.email, ...email });
  }

  return NextResponse.json(memory, { status: 201 });
}
