export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function buildSlug(id: string, name: string): string {
  return `${id}-${slugify(name)}`;
}

// CUIDs from Prisma are 25 characters
export function parseIdFromSlug(slug: string): string {
  return slug.slice(0, 25);
}
