import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUserDisabled } from "@/lib/admin";
import mammoth from "mammoth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be 10MB or smaller" }, { status: 400 });
  }

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Only Word (.docx) files are supported" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();

  // Verify ZIP/DOCX magic bytes: PK\x03\x04
  const magic = new Uint8Array(arrayBuffer, 0, 4);
  if (magic[0] !== 0x50 || magic[1] !== 0x4b || magic[2] !== 0x03 || magic[3] !== 0x04) {
    return NextResponse.json({ error: "Only Word (.docx) files are supported" }, { status: 400 });
  }

  const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
  const text = result.value.trim();

  if (!text) {
    return NextResponse.json({ error: "No text could be extracted from the file" }, { status: 422 });
  }

  return NextResponse.json({ text });
}
