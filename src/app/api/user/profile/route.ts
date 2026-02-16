import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;

  if (name !== undefined && name.length > 100) {
    return NextResponse.json(
      { error: "Name must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name || null },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(user);
}
