import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memory: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { GET } from "../route";

const USER_ID = "user-001";
const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(id: string) {
  return { user: { id } };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/feed/activity");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

const mockMemories = [
  {
    id: "mem-001",
    name: "Alice",
    withholdName: false,
    relation: "Friend",
    text: "A wonderful person",
    createdAt: new Date("2025-01-10"),
    memorial: { id: "memorial-001", slug: "memorial-001-jane", name: "Jane Doe" },
  },
  {
    id: "mem-002",
    name: "Bob",
    withholdName: true,
    relation: null,
    text: "Will be missed",
    createdAt: new Date("2025-01-09"),
    memorial: { id: "memorial-001", slug: "memorial-001-jane", name: "Jane Doe" },
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession(USER_ID) as never);
  m(prisma.memory.findMany).mockResolvedValue(mockMemories);
  m(prisma.memory.count).mockResolvedValue(2);
});

describe("GET /api/feed/activity", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns activity items with total and pagination info", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.skip).toBe(0);
    expect(body.take).toBe(5);
  });

  it("nullifies name when withholdName is true", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.items[0].name).toBe("Alice");
    expect(body.items[1].name).toBeNull();
  });

  it("respects skip and take params", async () => {
    const res = await GET(makeRequest({ skip: "5", take: "10" }));
    const body = await res.json();
    expect(body.skip).toBe(5);
    expect(body.take).toBe(10);
    expect(m(prisma.memory.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 10 })
    );
  });

  it("caps take at MAX_TAKE (20)", async () => {
    const res = await GET(makeRequest({ take: "100" }));
    const body = await res.json();
    expect(body.take).toBe(20);
  });

  it("queries only ACCEPTED memories from non-disabled pages owned or followed by user", async () => {
    await GET(makeRequest());
    expect(m(prisma.memory.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACCEPTED",
          memorial: expect.objectContaining({
            disabled: false,
            OR: expect.arrayContaining([
              { ownerId: USER_ID },
              { followers: { some: { userId: USER_ID } } },
            ]),
          }),
        }),
      })
    );
  });
});
