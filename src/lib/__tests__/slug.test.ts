import { describe, it, expect } from "vitest";
import { slugify, buildSlug, parseIdFromSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases input", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("foo bar baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing whitespace", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(slugify("foo   bar")).toBe("foo-bar");
  });

  it("collapses multiple hyphens into a single hyphen", () => {
    expect(slugify("foo--bar")).toBe("foo-bar");
  });

  it("strips non-alphanumeric characters (accents, punctuation)", () => {
    expect(slugify("café")).toBe("caf");
    expect(slugify("O'Brien")).toBe("obrien");
    expect(slugify("hello!")).toBe("hello");
  });

  it("preserves existing hyphens", () => {
    expect(slugify("well-known")).toBe("well-known");
  });

  it("handles an already-valid slug unchanged", () => {
    expect(slugify("john-doe")).toBe("john-doe");
  });

  it("handles an empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles a string that becomes empty after stripping", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("handles numbers", () => {
    expect(slugify("Memorial 123")).toBe("memorial-123");
  });
});

describe("buildSlug", () => {
  it("prepends id to slugified name with a hyphen", () => {
    const id = "cuid25charsexamplehere";
    expect(buildSlug(id, "John Doe")).toBe(`${id}-john-doe`);
  });

  it("slugifies the name portion", () => {
    const id = "abc";
    expect(buildSlug(id, "  Hello World!!  ")).toBe(`${id}-hello-world`);
  });
});

describe("parseIdFromSlug", () => {
  it("extracts the first 25 characters as the CUID", () => {
    const id = "cmc1234567890123456789012"; // exactly 25 chars (CUID2 length)
    const slug = `${id}-john-doe`;
    expect(parseIdFromSlug(slug)).toBe(id);
  });

  it("returns first 25 chars even when slug has no name part", () => {
    const slug = "1234567890123456789012345";
    expect(parseIdFromSlug(slug)).toBe("1234567890123456789012345");
  });

  it("handles a slug shorter than 25 chars without throwing", () => {
    expect(parseIdFromSlug("short")).toBe("short");
  });
});
