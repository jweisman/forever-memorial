import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSlug } from "@/lib/slug";
import { generateViewUrl } from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";
import DOMPurify from "isomorphic-dompurify";

const LIFE_STORY_ALLOWED_TAGS = ["p", "br", "strong", "em", "h2", "h3"];

export const GET = withHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    include: {
      eulogies: { orderBy: { order: "asc" } },
      owner: { select: { id: true, name: true } },
    },
  });

  if (!memorial || memorial.disabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolve memorial picture S3 key to presigned URL
  let memorialPictureUrl: string | null = null;
  if (memorial.memorialPicture) {
    memorialPictureUrl = await generateViewUrl(memorial.memorialPicture);
  }

  return NextResponse.json({
    ...memorial,
    memorialPicture: memorialPictureUrl,
  });
});

export const PATCH = withHandler(async (
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
    select: { ownerId: true, name: true },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "Name is required and must be 200 characters or fewer" },
        { status: 400 }
      );
    }
    data.name = name;
    data.slug = buildSlug(id, name);
  }

  if (body.dateOfDeath !== undefined) {
    const dateOfDeath = new Date(body.dateOfDeath);
    if (isNaN(dateOfDeath.getTime())) {
      return NextResponse.json(
        { error: "Invalid date of death" },
        { status: 400 }
      );
    }
    data.dateOfDeath = dateOfDeath;
  }

  if (body.birthday !== undefined) {
    if (body.birthday) {
      const birthday = new Date(body.birthday);
      if (isNaN(birthday.getTime())) {
        return NextResponse.json(
          { error: "Invalid birthday" },
          { status: 400 }
        );
      }
      data.birthday = birthday;
    } else {
      data.birthday = null;
    }
  }

  if (body.placeOfDeath !== undefined) {
    data.placeOfDeath = body.placeOfDeath?.trim() || null;
  }
  if (body.funeralInfo !== undefined) {
    data.funeralInfo = body.funeralInfo?.trim() || null;
  }
  if (body.survivedBy !== undefined) {
    data.survivedBy = body.survivedBy?.trim() || null;
  }
  if (body.lifeStory !== undefined) {
    const raw = body.lifeStory?.trim() || null;
    data.lifeStory = raw
      ? DOMPurify.sanitize(raw, {
          ALLOWED_TAGS: LIFE_STORY_ALLOWED_TAGS,
          ALLOWED_ATTR: [],
        }) || null
      : null;
  }
  if (body.projects !== undefined) {
    data.projects = body.projects?.trim() || null;
  }
  if (body.deathAfterSunset !== undefined) {
    data.deathAfterSunset = body.deathAfterSunset === true;
  }

  const updated = await prisma.memorial.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
});

export const DELETE = withHandler(async (
  _request: Request,
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

  await prisma.memorial.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
