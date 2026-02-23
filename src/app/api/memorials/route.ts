import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSlug } from "@/lib/slug";
import { isUserDisabled } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memorials = await prisma.memorial.findMany({
    where: { ownerId: session.user.id, disabled: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      birthday: true,
      dateOfDeath: true,
      placeOfDeath: true,
      memorialPicture: true,
      createdAt: true,
    },
  });

  return NextResponse.json(memorials);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const dateOfDeathStr = body.dateOfDeath;

  if (!name || name.length > 200) {
    return NextResponse.json(
      { error: "Name is required and must be 200 characters or fewer" },
      { status: 400 }
    );
  }

  if (!dateOfDeathStr) {
    return NextResponse.json(
      { error: "Date of death is required" },
      { status: 400 }
    );
  }

  const dateOfDeath = new Date(dateOfDeathStr);
  if (isNaN(dateOfDeath.getTime())) {
    return NextResponse.json(
      { error: "Invalid date of death" },
      { status: 400 }
    );
  }

  let birthday: Date | undefined;
  if (body.birthday) {
    birthday = new Date(body.birthday);
    if (isNaN(birthday.getTime())) {
      return NextResponse.json(
        { error: "Invalid birthday" },
        { status: 400 }
      );
    }
  }

  // Create with temporary slug, then update with real slug containing the ID
  const memorial = await prisma.memorial.create({
    data: {
      slug: `temp-${Date.now()}`,
      ownerId: session.user.id,
      name,
      dateOfDeath,
      birthday: birthday ?? null,
      placeOfDeath: body.placeOfDeath?.trim() || null,
      funeralInfo: body.funeralInfo?.trim() || null,
      survivedBy: body.survivedBy?.trim() || null,
      lifeStory: body.lifeStory?.trim() || null,
    },
  });

  const slug = buildSlug(memorial.id, name);
  const updated = await prisma.memorial.update({
    where: { id: memorial.id },
    data: { slug },
  });

  return NextResponse.json(updated, { status: 201 });
}
