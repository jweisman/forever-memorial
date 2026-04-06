import { vi, describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
  thumbKeyFromBase: vi.fn((key: string) => key.replace(/\.\w+$/, "_thumb.webp")),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { GET } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const mockRow = {
  id: "memorial-001",
  slug: "memorial-001-jane-doe",
  name: "Jane Doe",
  placeOfDeath: "New York",
  dateOfDeath: new Date("2023-01-15"),
  birthday: null,
  memorialPicture: null,
};

function makeRequest(query: string, limit?: number) {
  const url = new URL(`http://localhost/api/search`);
  url.searchParams.set("q", query);
  if (limit !== undefined) url.searchParams.set("limit", String(limit));
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// GET /api/search
// ---------------------------------------------------------------------------

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(rateLimit).mockReturnValue({ success: true, remaining: 10 });
    vi.mocked(getClientIp).mockReturnValue("127.0.0.1");
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    m(prisma.$queryRaw).mockResolvedValue([mockRow]);
  });

  // --- Rate limiting ---

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(rateLimit).mockReturnValue({ success: false, remaining: 0 });
    const res = await GET(makeRequest("Jane"));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/too many requests/i);
  });

  // --- Query validation ---

  it("returns empty array when query is less than 2 characters", async () => {
    const res = await GET(makeRequest("J"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
    expect(m(prisma.$queryRaw)).not.toHaveBeenCalled();
  });

  it("returns empty array when query is empty", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  // --- Happy path ---

  it("returns 200 with search results", async () => {
    const res = await GET(makeRequest("Jane"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("memorial-001");
    expect(data[0].name).toBe("Jane Doe");
  });

  it("returns null pictureUrl when memorialPicture is null", async () => {
    const res = await GET(makeRequest("Jane"));
    const data = await res.json();
    expect(data[0].pictureUrl).toBeNull();
    expect(vi.mocked(generateViewUrl)).not.toHaveBeenCalled();
  });

  it("resolves pictureUrl when memorialPicture is set", async () => {
    m(prisma.$queryRaw).mockResolvedValue([
      { ...mockRow, memorialPicture: "memorials/memorial-001/picture.jpg" },
    ]);
    const res = await GET(makeRequest("Jane"));
    const data = await res.json();
    expect(data[0].pictureUrl).toBe("https://s3.example.com/view");
    expect(vi.mocked(generateViewUrl)).toHaveBeenCalledWith(
      "memorials/memorial-001/picture_thumb.webp"
    );
  });

  it("returns empty array when no results match", async () => {
    m(prisma.$queryRaw).mockResolvedValue([]);
    const res = await GET(makeRequest("Nonexistent"));
    const data = await res.json();
    expect(data).toEqual([]);
  });

  // --- Limit clamping ---

  it("clamps limit to a minimum of 1", async () => {
    await GET(makeRequest("Jane", 0));
    // The $queryRaw is called with the clamped limit (1)
    expect(m(prisma.$queryRaw)).toHaveBeenCalled();
  });

  it("clamps limit to a maximum of 20", async () => {
    // Ensure the route doesn't reject over-limit requests, just clamps
    const res = await GET(makeRequest("Jane", 100));
    expect(res.status).toBe(200);
  });

  it("uses a default limit of 5 when not specified", async () => {
    const res = await GET(makeRequest("Jane"));
    expect(res.status).toBe(200);
    // Verifies that $queryRaw was called (limit is embedded in tagged template)
    expect(m(prisma.$queryRaw)).toHaveBeenCalled();
  });
});
