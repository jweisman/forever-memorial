import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "path";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withHandler } from "@/lib/api-error";

type Params = { id: string };

async function generatePosterPDF(
  name: string,
  dates: string,
  qrBuffer: Buffer,
  url: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = path.join(
      process.cwd(),
      "public/fonts/NotoSansHebrew-Bold.ttf"
    );
    doc.registerFont("NotoHebrew", fontPath);

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    const gold = "#C9A84C";
    const dark = "#3D2E22";
    const muted = "#8A7B6B";

    // Background
    doc.rect(0, 0, pageWidth, pageHeight).fill("#FFFDF9");

    // Top gold rule
    doc
      .moveTo(margin, 58)
      .lineTo(pageWidth - margin, 58)
      .lineWidth(1.5)
      .strokeColor(gold)
      .stroke();

    // Branding — two centered lines, one per script
    doc
      .fontSize(10)
      .font("NotoHebrew")
      .fillColor(gold)
      .text("לעולם", margin, 65, {
        align: "center",
        width: contentWidth,
        features: [],
      });
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(gold)
      .text("Forever", margin, doc.y + 1, {
        align: "center",
        width: contentWidth,
      });

    doc.moveDown(2);

    // Memorial name — use Hebrew font + full-string BiDi if name contains Hebrew
    const hasHebrew = /[\u05D0-\u05EA]/.test(name);
    doc
      .fontSize(32)
      .font(hasHebrew ? "NotoHebrew" : "Helvetica")
      .fillColor(dark)
      .text(name, margin, doc.y, {
        align: "center",
        width: contentWidth,
        ...(hasHebrew ? { features: [] } : {}),
      });

    doc.moveDown(0.6);

    // Dates
    doc
      .fontSize(13)
      .font("Helvetica")
      .fillColor(muted)
      .text(dates, margin, doc.y, { align: "center", width: contentWidth });

    doc.moveDown(2.5);

    // QR code — centered on page, advances cursor
    const qrSize = 220;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = doc.y;
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    // Manually advance cursor past the image
    doc.y = qrY + qrSize + 20;

    // Call to action — two centered lines, one per script
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor(dark)
      .text("Scan to share a memory", margin, doc.y, {
        align: "center",
        width: contentWidth,
      });
    doc
      .fontSize(12)
      .font("NotoHebrew")
      .fillColor(dark)
      .text("סרקו לשיתוף זיכרון", margin, doc.y + 2, {
        align: "center",
        width: contentWidth,
        features: [],
      });

    doc.moveDown(0.5);

    // URL
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(muted)
      .text(url, margin, doc.y, { align: "center", width: contentWidth });

    // Bottom gold rule
    const bottomY = pageHeight - 58;
    doc
      .moveTo(margin, bottomY)
      .lineTo(pageWidth - margin, bottomY)
      .lineWidth(1.5)
      .strokeColor(gold)
      .stroke();

    doc.end();
  });
}

export const GET = withHandler(async (
  request: Request,
  { params }: { params: Promise<Params> }
) => {
  const ip = getClientIp(request);
  const { success } = rateLimit({
    key: `poster:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: {
      name: true,
      slug: true,
      birthday: true,
      dateOfDeath: true,
      disabled: true,
    },
  });

  if (!memorial || memorial.disabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const birthYear = memorial.birthday
    ? new Date(memorial.birthday).getFullYear()
    : null;
  const deathYear = new Date(memorial.dateOfDeath).getFullYear();
  const dates = birthYear ? `${birthYear} – ${deathYear}` : String(deathYear);

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/memorial/${memorial.slug}`;

  const qrBuffer = await QRCode.toBuffer(url, {
    width: 240,
    margin: 1,
    color: { dark: "#3D2E22", light: "#FFFDF9" },
  });

  const safeName = memorial.name.replace(/[^a-z0-9]/gi, "_");
  const pdfBuffer = await generatePosterPDF(memorial.name, dates, qrBuffer, url);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="memorial-poster-${safeName}.pdf"`,
    },
  });
});
