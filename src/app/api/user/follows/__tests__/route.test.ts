import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorialFollow: { findMany: vi.fn() },
  },
}));

import { GET } from "../route";

const USER_ID = "user-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(id: string) {
  return { user: { id } };
}

const mockFollows = [
  {
    memorial: {
      id: "memorial-001",
      slug: "memorial-001-jane-doe",
      name: "Jane Doe",
      birthday: new Date("1940-01-01"),
      dateOfDeath: new Date("2020-06-15"),
      placeOfDeath: "New York",
      memorialPicture: null,
      createdAt: new Date("2024-01-01"),
      disabled: false,
    },
  },
  {
    memorial: {
      id: "memorial-002",
      slug: "memorial-002-john-smith",
      name: "John Smith",
      birthday: null,
      dateOfDeath: new Date("2021-03-10"),
      placeOfDeath: null,
      memorialPicture: null,
      createdAt: new Date("2024-02-01"),
      disabled: false,
    },
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession(USER_ID) as never);
  m(prisma.memorialFollow.findMany).mockResolvedValue(mockFollows);
});

describe("GET /api/user/follows", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns list of followed non-disabled memorials", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("Jane Doe");
    expect(body[1].name).toBe("John Smith");
  });

  it("filters out disabled memorials", async () => {
    m(prisma.memorialFollow.findMany).mockResolvedValue([
      ...mockFollows,
      {
        memorial: {
          id: "memorial-003",
          slug: "memorial-003-disabled",
          name: "Disabled Memorial",
          birthday: null,
          dateOfDeath: new Date("2022-01-01"),
          placeOfDeath: null,
          memorialPicture: null,
          createdAt: new Date("2024-03-01"),
          disabled: true,
        },
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body.find((m: { name: string }) => m.name === "Disabled Memorial")).toBeUndefined();
  });

  it("returns empty array when not following anything", async () => {
    m(prisma.memorialFollow.findMany).mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("queries follows for the authenticated user", async () => {
    await GET();
    expect(m(prisma.memorialFollow.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
      })
    );
  });
});
