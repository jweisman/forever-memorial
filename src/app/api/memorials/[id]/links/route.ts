import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { id: true, disabled: true },
  });

  if (!memorial || memorial.disabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const links = await prisma.memorialLink.findMany({
    where: { memorialId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(links);
});

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Extract content from a <meta property/name="key" content="..."> tag, either attribute order. */
function getMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const val =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"))?.[1] ??
    null;
  return val ? decodeHtmlEntities(val) : null;
}

async function fetchOgData(url: string): Promise<{ title: string | null; description: string | null; imageUrl: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return { title: null, description: null, imageUrl: null };
    const html = await res.text();

    // Title: og:title → twitter:title → <title> tag
    const rawPageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    const title =
      getMetaContent(html, "og:title") ??
      getMetaContent(html, "twitter:title") ??
      (rawPageTitle ? decodeHtmlEntities(rawPageTitle) : null);

    // Description: og:description → twitter:description
    const description =
      getMetaContent(html, "og:description") ??
      getMetaContent(html, "twitter:description");

    // Image: og:image → twitter:image; resolve relative URLs
    const rawImage =
      getMetaContent(html, "og:image") ??
      getMetaContent(html, "twitter:image") ??
      null;
    let imageUrl: string | null = rawImage;
    if (imageUrl && !imageUrl.startsWith("http")) {
      try {
        imageUrl = new URL(imageUrl, url).toString();
      } catch {
        imageUrl = null;
      }
    }

    return { title, description: description ?? null, imageUrl };
  } catch {
    return { title: null, description: null, imageUrl: null };
  }
}

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
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const titleOverride = typeof body.title === "string" ? body.title.trim() : "";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
  }

  const maxOrder = await prisma.memorialLink.aggregate({
    where: { memorialId: id },
    _max: { order: true },
  });

  const og = await fetchOgData(rawUrl);

  const domain = parsedUrl.hostname.replace(/^www\./, "");
  const resolvedTitle = titleOverride || og.title || domain;

  const link = await prisma.memorialLink.create({
    data: {
      memorialId: id,
      url: rawUrl,
      title: resolvedTitle,
      description: og.description,
      imageUrl: og.imageUrl,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(link, { status: 201 });
});
