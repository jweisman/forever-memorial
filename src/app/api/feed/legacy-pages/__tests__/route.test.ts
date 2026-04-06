import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn(),
}));

import { GET } from "../route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/feed/legacy-pages");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

const USER_ID = "user-001";

const mockPages = [
  {
    id: "memorial-001",
    slug: "memorial-001-jane-doe",
    name: "Jane Doe",
    birthday: new Date("1940-01-01"),
    dateOfDeath: new Date("2020-06-15"),
    deathAfterSunset: false,
    placeOfDeath: "New York",
    memorialPicture: "pics/memorial-001/base.jpg",
    updatedAt: new Date("2025-03-01"),
  },
  {
    id: "memorial-002",
    slug: "memorial-002-john-smith",
    name: "John Smith",
    birthday: null,
    dateOfDeath: new Date("2021-03-10"),
    deathAfterSunset: false,
    placeOfDeath: null,
    memorialPicture: null,
    updatedAt: new Date("2025-02-15"),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: USER_ID } } as never);
  m(prisma.memorial.findMany).mockResolvedValue(mockPages);
  m(prisma.memorial.count).mockResolvedValue(2);
  vi.mocked(generateViewUrl).mockResolvedValue("https://cdn.example.com/pic.jpg");
});

describe("GET /api/feed/legacy-pages", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns legacy pages with total and pagination info", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.skip).toBe(0);
    expect(body.take).toBe(5);
  });

  it("resolves pictureUrl for pages with a picture", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.items[0].pictureUrl).toBe("https://cdn.example.com/pic.jpg");
    expect(body.items[1].pictureUrl).toBeNull();
  });

  it("respects skip and take params", async () => {
    const res = await GET(makeRequest({ skip: "5", take: "10" }));
    const body = await res.json();
    expect(body.skip).toBe(5);
    expect(body.take).toBe(10);
    expect(m(prisma.memorial.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 10 })
    );
  });

  it("caps take at MAX_TAKE (20)", async () => {
    const res = await GET(makeRequest({ take: "100" }));
    const body = await res.json();
    expect(body.take).toBe(20);
  });

  it("filters by owned or followed pages by default", async () => {
    await GET(makeRequest());
    expect(m(prisma.memorial.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          disabled: false,
          OR: [
            { ownerId: USER_ID },
            { followers: { some: { userId: USER_ID } } },
          ],
        },
        orderBy: { updatedAt: "desc" },
      })
    );
  });

  it("filters by owned pages when filter=owned", async () => {
    await GET(makeRequest({ filter: "owned" }));
    expect(m(prisma.memorial.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { disabled: false, ownerId: USER_ID },
      })
    );
  });

  it("filters by followed pages when filter=followed", async () => {
    await GET(makeRequest({ filter: "followed" }));
    expect(m(prisma.memorial.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { disabled: false, followers: { some: { userId: USER_ID } } },
      })
    );
  });
});
