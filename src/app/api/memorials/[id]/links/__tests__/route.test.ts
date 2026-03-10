import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    memorialLink: {
      findMany: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));

import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";
const LINK_ID = "link-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

const mockMemorial = { id: MEMORIAL_ID, ownerId: OWNER_ID, disabled: false };

const mockLink = {
  id: LINK_ID,
  memorialId: MEMORIAL_ID,
  url: "https://example.com",
  title: "Example",
  description: "An example site",
  imageUrl: "https://example.com/og.png",
  order: 0,
  createdAt: new Date(),
};

function makeGetRequest() {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/links`);
}

function makePostRequest(body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

// Stub global fetch for OG scraping
function stubFetchOg({ ok = true, html = "" } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      text: () => Promise.resolve(html),
    })
  );
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]/links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m(prisma.memorial.findUnique).mockResolvedValue(mockMemorial);
    m(prisma.memorialLink.findMany).mockResolvedValue([mockLink]);
  });

  it("returns 404 when memorial is not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when memorial is disabled", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue({ ...mockMemorial, disabled: true });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 with the links array", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(LINK_ID);
  });

  it("returns an empty array when there are no links", async () => {
    m(prisma.memorialLink.findMany).mockResolvedValue([]);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.memorial.findUnique).mockResolvedValue(mockMemorial);
    m(prisma.memorialLink.aggregate).mockResolvedValue({ _max: { order: null } });
    m(prisma.memorialLink.create).mockResolvedValue(mockLink);
    stubFetchOg({
      ok: true,
      html: `<meta property="og:title" content="OG Title" />
             <meta property="og:description" content="OG Desc" />
             <meta property="og:image" content="https://example.com/og.png" />`,
    });
  });

  // --- Auth & guard ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makePostRequest({ url: "https://example.com", title: "Ex" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makePostRequest({ url: "https://example.com", title: "Ex" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await POST(makePostRequest({ url: "https://example.com", title: "Ex" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await POST(makePostRequest({ url: "https://example.com", title: "Ex" }), makeParams());
    expect(res.status).toBe(403);
  });

  // --- Input validation ---

  it("returns 201 when title is empty (falls back to OG title)", async () => {
    stubFetchOg({ ok: true, html: `<meta property="og:title" content="Example Site">` });
    await POST(makePostRequest({ url: "https://example.com", title: "" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Example Site" }),
      })
    );
  });

  it("returns 201 when title is empty and no OG title (falls back to domain)", async () => {
    stubFetchOg({ ok: true, html: `<html></html>` });
    await POST(makePostRequest({ url: "https://example.com", title: "" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "example.com" }),
      })
    );
  });

  it("returns 400 when URL is not a valid URL", async () => {
    const res = await POST(makePostRequest({ url: "not-a-url", title: "Test" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/url/i);
  });

  it("returns 400 when URL uses a non-http/https scheme", async () => {
    const res = await POST(makePostRequest({ url: "ftp://example.com", title: "Test" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/http/i);
  });

  // --- Happy path ---

  it("returns 201 with the created link", async () => {
    const res = await POST(makePostRequest({ url: "https://example.com", title: "Example" }), makeParams());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(LINK_ID);
  });

  it("stores OG description and imageUrl from scraped page", async () => {
    await POST(makePostRequest({ url: "https://example.com", title: "Example" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "OG Desc",
          imageUrl: "https://example.com/og.png",
        }),
      })
    );
  });

  it("falls back to twitter:title when og:title is absent", async () => {
    stubFetchOg({ ok: true, html: `<meta name="twitter:title" content="Twitter Title">` });
    await POST(makePostRequest({ url: "https://example.com", title: "" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Twitter Title" }),
      })
    );
  });

  it("falls back to <title> tag when no og/twitter title", async () => {
    stubFetchOg({ ok: true, html: `<html><head><title>Page Title</title></head></html>` });
    await POST(makePostRequest({ url: "https://example.com", title: "" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Page Title" }),
      })
    );
  });

  it("falls back to twitter:image when og:image is absent", async () => {
    stubFetchOg({
      ok: true,
      html: `<meta property="og:title" content="T" />
             <meta name="twitter:image" content="https://example.com/twitter.png" />`,
    });
    await POST(makePostRequest({ url: "https://example.com", title: "Example" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: "https://example.com/twitter.png" }),
      })
    );
  });

  it("resolves a relative og:image URL against the page origin", async () => {
    stubFetchOg({
      ok: true,
      html: `<meta property="og:title" content="T" />
             <meta property="og:image" content="/images/share.png" />`,
    });
    await POST(makePostRequest({ url: "https://example.com/page", title: "Example" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: "https://example.com/images/share.png" }),
      })
    );
  });

  it("decodes HTML entities in scraped title", async () => {
    stubFetchOg({ ok: true, html: `<meta property="og:title" content="Foo &amp; Bar &quot;Baz&quot;">` });
    await POST(makePostRequest({ url: "https://example.com", title: "" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: `Foo & Bar "Baz"` }),
      })
    );
  });

  it("creates link with null OG fields when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const res = await POST(makePostRequest({ url: "https://example.com", title: "Example" }), makeParams());
    expect(res.status).toBe(201);
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          imageUrl: null,
        }),
      })
    );
  });

  it("assigns order 0 for the first link", async () => {
    m(prisma.memorialLink.aggregate).mockResolvedValue({ _max: { order: null } });
    await POST(makePostRequest({ url: "https://example.com", title: "Example" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 0 }),
      })
    );
  });

  it("assigns order max+1 when links already exist", async () => {
    m(prisma.memorialLink.aggregate).mockResolvedValue({ _max: { order: 2 } });
    await POST(makePostRequest({ url: "https://example.com", title: "Example" }), makeParams());
    expect(m(prisma.memorialLink.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 3 }),
      })
    );
  });
});
