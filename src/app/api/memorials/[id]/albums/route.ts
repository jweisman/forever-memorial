import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const albums = await prisma.album.findMany({
    where: { memorialId: id },
    orderBy: { order: "asc" },
    include: {
      images: { orderBy: { order: "asc" } },
      _count: { select: { images: true } },
    },
  });

  // Resolve presigned URLs for all images
  const albumsWithUrls = await Promise.all(
    albums.map(async (album) => ({
      ...album,
      images: await Promise.all(
        album.images.map(async (img) => ({
          ...img,
          thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
          url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
        }))
      ),
    }))
  );

  return NextResponse.json(albumsWithUrls);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "Album name is required" },
      { status: 400 }
    );
  }

  // Set order to max+1
  const maxOrder = await prisma.album.aggregate({
    where: { memorialId: id },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const album = await prisma.album.create({
    data: { memorialId: id, name, order: nextOrder },
  });

  return NextResponse.json(album, { status: 201 });
}
